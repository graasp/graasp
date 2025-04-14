import { Readable } from 'stream';
import { delay, inject, singleton } from 'tsyringe';

import {
  ItemType,
  ItemVisibilityType,
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_ITEM_NAME_LENGTH,
  MAX_NUMBER_OF_CHILDREN,
  Paginated,
  Pagination,
  PermissionLevel,
  PermissionLevelCompare,
  PermissionLevelOptions,
  UUID,
  buildPathFromIds,
  getIdsFromPath,
  getParentFromPath,
} from '@graasp/sdk';

import { type DBConnection } from '../../drizzle/db';
import {
  Item,
  ItemGeolocationRaw,
  ItemMembershipRaw,
  ItemRaw,
  ItemTypeUnion,
  ItemWithCreator,
  MinimalItemForInsert,
} from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { AuthenticatedUser, MaybeUser, MinimalMember } from '../../types';
import {
  CannotReorderRootItem,
  InvalidMembership,
  ItemNotFolder,
  MissingNameOrTypeForItemError,
  TooManyChildren,
  TooManyDescendants,
  UnauthorizedMember,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { AuthorizationService } from '../authorization';
import {
  filterOutItems,
  filterOutPackedDescendants,
  filterOutPackedItems,
} from '../authorization.utils';
import { ItemMembershipRepository } from '../itemMembership/membership.repository';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { ItemWrapper, ItemWrapperService, PackedItem } from './ItemWrapper';
import { BasicItemService } from './basic.service';
import { DEFAULT_ORDER, IS_COPY_REGEX, MAX_COPY_SUFFIX_LENGTH } from './constants';
import { FolderItem, isItemType } from './discrimination';
import { ItemRepository } from './item.repository';
import { ItemGeolocationRepository } from './plugins/geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from './plugins/itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from './plugins/publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch';
import { RecycledBinService } from './plugins/recycled/recycled.service';
import { ItemThumbnailService } from './plugins/thumbnail/itemThumbnail.service';
import { ItemChildrenParams, ItemSearchParams } from './types';

@singleton()
export class ItemService {
  private readonly log: BaseLogger;
  private readonly thumbnailService: ThumbnailService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  protected readonly itemThumbnailService: ItemThumbnailService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  protected readonly itemRepository: ItemRepository;
  protected readonly authorizationService: AuthorizationService;
  private readonly itemWrapperService: ItemWrapperService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  public readonly basicItemService: BasicItemService;
  public readonly recycledBinService: RecycledBinService;

  hooks = new HookManager<{
    create: { pre: { item: Partial<Item> }; post: { item: Item } };
    update: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
    copy: { pre: { original: Item }; post: { original: Item; copy: MinimalItemForInsert } };
    move: {
      pre: {
        /** the item to be moved itself */
        source: Item;
        /** the parent item where the item will be moved */
        destinationParent?: Item;
      };
      post: {
        /** the item before it was moved */
        source: Item;
        /** id of the previous parent */
        sourceParentId?: UUID;
        /** the item itself once moved */
        destination: Item;
      };
    };
  }>();

  constructor(
    thumbnailService: ThumbnailService,
    @inject(delay(() => ItemThumbnailService))
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizationService: AuthorizationService,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    basicItemService: BasicItemService,
    recycledBinService: RecycledBinService,
    log: BaseLogger,
  ) {
    this.thumbnailService = thumbnailService;
    this.itemThumbnailService = itemThumbnailService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.meilisearchWrapper = meilisearchWrapper;
    this.itemPublishedRepository = itemPublishedRepository;
    this.itemGeolocationRepository = itemGeolocationRepository;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.itemWrapperService = itemWrapperService;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.basicItemService = basicItemService;
    this.recycledBinService = recycledBinService;
    this.log = log;
  }

  /**
   * Post a single item
   */
  async post(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocationRaw, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ): Promise<Item> {
    const { item, parentId, previousItemId, geolocation, thumbnail } = args;

    // item
    // take the first and (must be) the only item
    const createdItems = await this.createItems(
      dbConnection,
      member,
      [item],
      parentId,
      previousItemId,
    );

    const [updatedItem] = await this.saveGeolocationsAndThumbnails(
      dbConnection,
      member,
      [{ item, geolocation, thumbnail }],
      createdItems,
    );

    return updatedItem;
  }

  /**
   * Post multiple items, with optional geolocations and thumbnails.
   */
  async postMany(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      items: {
        item: Partial<Item> & Pick<Item, 'name' | 'type'>;
        geolocation?: Pick<ItemGeolocationRaw, 'lat' | 'lng'>;
        thumbnail?: Readable;
      }[];
      parentId: string;
    },
  ): Promise<Item[]> {
    const { items: inputItems, parentId } = args;

    // create items
    const itemsToInsert = inputItems.map((i) => i.item);
    const createdItems = await this.createItems(dbConnection, member, itemsToInsert, parentId);

    return this.saveGeolocationsAndThumbnails(dbConnection, member, inputItems, createdItems);
  }

  private async saveGeolocationsAndThumbnails(
    dbConnection: DBConnection,
    member: MinimalMember,
    inputItems: {
      item: Partial<Item> & Pick<Item, 'name' | 'type'>;
      thumbnail?: Readable;
      geolocation?: Pick<ItemGeolocationRaw, 'lat' | 'lng'>;
    }[],
    createdItems: Item[],
  ) {
    const insertedItems = await this.itemRepository.getMany(
      dbConnection,
      createdItems.map((i) => i.id),
    );

    // order items from the db
    // to get them in the same order as the input item array
    // TODO: CHECK!!
    const orderedItems = Object.values(insertedItems.data);
    orderedItems.sort((a, b) => {
      const aIdx = inputItems.findIndex((i) => i.item.id === a.id);
      const bIdx = inputItems.findIndex((i) => i.item.id === b.id);
      return aIdx > bIdx ? 1 : -1;
    });

    // construct geolocation and thumbnail maps
    const geolocations = {};
    const thumbnails = {};
    for (let i = 0; i < inputItems.length; i++) {
      const geolocation = inputItems[i].geolocation;
      if (geolocation) {
        geolocations[orderedItems[i].path] = geolocation;
      }

      const thumbnail = inputItems[i].thumbnail;
      if (thumbnail) {
        thumbnails[orderedItems[i].id] = thumbnail;
      }
    }

    // register geolocations
    await this.saveGeolocations(dbConnection, this.itemGeolocationRepository, geolocations);

    // upload thumbnails
    return this.uploadThumbnails(dbConnection, member, createdItems, thumbnails);
  }

  /**
   * Creates the given items in the DB.
   * @param parentId Parent for the given items, if defined
   * @param previousItemId Defines the order of the items, if defined
   * @returns An unordered list of inserted items
   */
  private async createItems(
    dbConnection: DBConnection,
    member: MinimalMember,
    items: (Partial<Item> & Pick<Item, 'name' | 'type'>)[],
    parentId?: string,
    previousItemId?: string,
  ) {
    // name and type should exist
    for (const item of items) {
      if (!item.name || !item.type) {
        throw new MissingNameOrTypeForItemError(item);
      }
    }

    let createdItems: Item[];
    if (parentId) {
      createdItems = await this.createItemsWithParent(
        dbConnection,
        member,
        items,
        parentId,
        previousItemId,
      );
    } else {
      createdItems = await this.createItemsAndMemberships(dbConnection, member, items, null);
    }

    // index the items for search
    this.indexItemsForSearch(dbConnection, createdItems);

    return createdItems;
  }

  /**
   * Creates items under a certain parent in the DB.
   * @param previousItemId Defines the order of the items, if present
   * @returns An unordered list of inserted items
   */
  private async createItemsWithParent(
    dbConnection: DBConnection,
    member: MinimalMember,
    items: (Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>)[],
    parentId: string,
    previousItemId?: string,
  ) {
    this.log.debug(`verify parent ${parentId} exists and the member has permission over it`);
    const parentItem = await this.basicItemService.get(
      dbConnection,
      member,
      parentId,
      PermissionLevel.Write,
    );
    const inheritedMembership = await this.itemMembershipRepository.getInherited(
      dbConnection,
      parentItem.path,
      member.id,
      true,
    );

    // quick check, necessary for ts
    if (!isItemType(parentItem, ItemType.FOLDER)) {
      throw new ItemNotFolder(parentItem);
    }

    this.itemRepository.checkHierarchyDepth(parentItem);

    // check if there's too many children under the same parent
    const children = await this.itemRepository.getNonOrderedChildren(dbConnection, parentItem);
    if (children.length + items.length > MAX_NUMBER_OF_CHILDREN) {
      throw new TooManyChildren();
    }

    // no previous item adds at the beginning
    // else define order from given previous item id
    let order;
    if (!previousItemId) {
      order = await this.itemRepository.getFirstOrderValue(dbConnection, parentItem.path);
    } else {
      order = await this.itemRepository.getNextOrderCount(
        dbConnection,
        parentItem.path,
        previousItemId,
      );
    }
    for (let i = 0; i < items.length; i++) {
      items[i] = { ...items[i], order };
      order += DEFAULT_ORDER;
    }

    const createdItems = await this.createItemsAndMemberships(
      dbConnection,
      member,
      items,
      inheritedMembership,
      parentItem,
    );

    // rescale the item ordering, if there's more than one item
    if (items.length > 1) {
      this.itemRepository.rescaleOrder(dbConnection, member, parentItem);
    }

    return createdItems;
  }

  /**
   * Creates items and its associated memberships in the DB
   * @returns An unordered list of inserted items
   */
  private async createItemsAndMemberships(
    dbConnection: DBConnection,
    member: MinimalMember,
    items: (Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>)[],
    inheritedMembership: ItemMembershipRaw | null,
    parentItem?: FolderItem,
  ) {
    this.log.debug(`create items ${items.map((item) => item.name)}`);
    const createdItems = await this.itemRepository.addMany(dbConnection, items, member, parentItem);
    this.log.debug(`items ${items.map((item) => item.name)} are created: ${createdItems}`);

    // create membership if inherited is less than admin
    if (
      !inheritedMembership ||
      PermissionLevelCompare.lt(inheritedMembership?.permission, PermissionLevel.Admin)
    ) {
      this.log.debug(`create membership for ${createdItems.map((item) => item.id)}`);
      const memberships = createdItems.map((item) => {
        return {
          itemPath: item.path,
          accountId: member.id,
          creatorId: member.id,
          permission: PermissionLevel.Admin,
        };
      });
      await this.itemMembershipRepository.addMany(dbConnection, memberships);
    }

    return createdItems;
  }

  /**
   * Save the geolocations in the repository.
   * @param geolocations Key-value map with the item path ID as key
   */
  private async saveGeolocations(
    dbConnection: DBConnection,
    itemGeolocationRepository: ItemGeolocationRepository,
    geolocations: { [key: string]: Pick<ItemGeolocationRaw, 'lat' | 'lng'> },
  ) {
    return Promise.all(
      Object.keys(geolocations).map(async (itemPath) => {
        const geolocation = geolocations[itemPath];
        if (geolocation) {
          return itemGeolocationRepository.put(dbConnection, itemPath, geolocations[itemPath]);
        }
      }),
    );
  }

  /**
   * Upload the item thumbnails.
   * @param thumbnails Key-value map with the item ID as key
   * @returns Items with updated `hasThumbnail` property
   */
  private async uploadThumbnails(
    dbConnection: DBConnection,
    member: MinimalMember,
    createdItems: Item[],
    thumbnails: { [key: string]: Readable },
  ): Promise<Item[]> {
    return Promise.all(
      createdItems.map(async (item) => {
        const thumbnail = thumbnails[item.id];
        if (thumbnail) {
          await this.thumbnailService.upload(member, item.id, thumbnail);
          return this.patch(dbConnection, member, item.id, {
            settings: { hasThumbnail: true },
          });
        } else {
          return item;
        }
      }),
    );
  }

  /**
   * Index items for meilisearch.
   */
  private async indexItemsForSearch(dbConnection: DBConnection, items: Item[]) {
    try {
      // Check if the item is published (or has published parent)
      const publishedInfo = await this.itemPublishedRepository.getForItems(
        dbConnection,
        items.map((i) => i.path),
      );

      if (publishedInfo.length) {
        return;
      }

      // update index
      await this.meilisearchWrapper.index(dbConnection, Object.values(publishedInfo));
    } catch (e) {
      this.log.error('Error during indexation, Meilisearch may be down');
    }
  }

  /**
   * get an item packed with complementary info
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async getPacked(
    dbConnection: DBConnection,
    actor: MaybeUser,
    id: string,
    permission: PermissionLevelOptions = PermissionLevel.Read,
  ) {
    const { item, itemMembership, visibilities } = await this.basicItemService._get(
      dbConnection,
      actor,
      id,
      permission,
    );
    const thumbnails = await this.itemThumbnailService.getUrlsByItems([item]);

    return new ItemWrapper(item, itemMembership, visibilities, thumbnails[item.id]).packed();
  }

  /**
   * get item packed with complementary items
   * @param actor
   * @param ids
   * @returns
   */
  async getManyPacked(dbConnection: DBConnection, actor: MaybeUser, ids: string[]) {
    const { items, itemMemberships, visibilities } = await this.basicItemService._getMany(
      dbConnection,
      actor,
      ids,
    );

    const thumbnails = await this.itemThumbnailService.getUrlsByItems(Object.values(items.data));

    return this.itemWrapperService.mergeResult(items, itemMemberships, visibilities, thumbnails);
  }

  async getAccessible(
    dbConnection: DBConnection,
    member: MinimalMember,
    params: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<PackedItem>> {
    const { data: items } = await this.itemRepository.getAccessibleItems(
      dbConnection,
      member,
      params,
      pagination,
    );

    const packedItems = await this.itemWrapperService.createPackedItems(dbConnection, items);
    return { data: packedItems, pagination };
  }

  private async _getChildren(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    return this.itemRepository.getChildren(dbConnection, actor, item, params);
  }

  async getChildren(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(dbConnection, actor, itemId, params);
    // TODO optimize?
    return filterOutItems(
      dbConnection,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      children,
    );
  }

  async getPackedChildren(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(dbConnection, actor, itemId, params);
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(children);

    // TODO optimize?
    return filterOutPackedItems(
      dbConnection,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      children,
      thumbnails,
    );
  }

  async getDescendants(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: UUID,
    options?: { types?: ItemTypeUnion[] },
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    if (!isItemType(item, ItemType.FOLDER)) {
      return { item, descendants: <ItemWithCreator[]>[] };
    }

    return {
      item,
      descendants: await this.itemRepository.getDescendants(dbConnection, item, options),
    };
  }

  // async getFilteredDescendants(dbConnection: DBConnection, account: MaybeUser, itemId: UUID) {
  //   const { descendants } = await this.getDescendants(dbConnection, account, itemId);
  //   if (!descendants.length) {
  //     return [];
  //   }
  //   // TODO optimize?
  //   return filterOutItems(
  //     dbConnection,
  //     account,
  //     {
  //       itemMembershipRepository: this.itemMembershipRepository,
  //       itemVisibilityRepository: this.itemVisibilityRepository,
  //     },
  //     descendants,
  //   );
  // }

  async getPackedDescendants(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: UUID,
    options?: { showHidden?: boolean; types?: ItemTypeUnion[] },
  ) {
    const { descendants, item } = await this.getDescendants(dbConnection, actor, itemId, options);
    if (!descendants.length) {
      return [];
    }
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(descendants);
    return filterOutPackedDescendants(
      dbConnection,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      item,
      descendants,
      thumbnails,
      options,
    );
  }

  async getParents(dbConnection: DBConnection, actor: MaybeUser, itemId: UUID) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);
    const parents = await this.itemRepository.getAncestors(dbConnection, item);

    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        dbConnection,
        PermissionLevel.Read,
        actor,
        parents,
      );
    // remove parents actor does not have access
    const parentsIds = Object.keys(itemMemberships.data);
    const items = parents.filter((p) => parentsIds.includes(p.id));
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(items);
    return this.itemWrapperService.merge(items, itemMemberships, visibilities, thumbnails);
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    body: Partial<Item>,
  ): Promise<Item> {
    // check memberships
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    await this.authorizationService.validatePermission(
      dbConnection,

      PermissionLevel.Write,
      member,
      item,
    );

    await this.hooks.runPreHooks('update', member, dbConnection, { item: item });

    const updated = await this.itemRepository.updateOne(dbConnection, item.id, body);

    await this.hooks.runPostHooks('update', member, dbConnection, { item: updated });

    try {
      // Check if the item is published (or has published parent)
      const published = await this.itemPublishedRepository.getForItem(dbConnection, item.path);

      // update index
      if (published) {
        await this.meilisearchWrapper.indexOne(dbConnection, published);
      }
    } catch (e) {
      this.log.error('Error during indexation, Meilisearch may be down');
    }

    return updated;
  }

  // QUESTION? DELETE BY PATH???
  async delete(dbConnection: DBConnection, actor: MinimalMember, itemId: UUID) {
    // check memberships
    const item = await this.itemRepository.getDeletedById(dbConnection, itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Admin,
      actor,
      item,
    );

    // check how "big the tree is" below the item
    // we do not use checkNumberOfDescendants because we use descendants
    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(dbConnection, item);
      if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
        throw new TooManyDescendants(descendants.length);
      }
      items = [...descendants, item];
    }

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, dbConnection, { item });
    }

    await this.itemRepository.delete(
      dbConnection,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, dbConnection, { item });

      try {
        await this.meilisearchWrapper.deleteOne(dbConnection, item);
      } catch {
        this.log.error('Error during indexation, Meilisearch may be down');
      }
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(dbConnection: DBConnection, actor: MinimalMember, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember();
    }

    const items = await this.recycledBinService.getDeletedTreesById(dbConnection, actor, itemIds);
    // do not delete too many items at the same time
    if (items.length > MAX_DESCENDANTS_FOR_DELETE) {
      throw new TooManyDescendants(items.length);
    }

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, dbConnection, { item });
    }

    await this.itemRepository.delete(
      dbConnection,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, dbConnection, { item });
    }

    return items;
  }

  /////// -------- MOVE
  async move(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    parentItem?: FolderItem,
  ) {
    let item;
    try {
      item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    } catch (e) {
      throw e;
    }

    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Admin,
      member,
      item,
    );

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(
      dbConnection,
      item,
      MAX_DESCENDANTS_FOR_MOVE,
    );

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        dbConnection,
        item,
      );
      // this function is not a promise!
      this.itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // post hook
    // question: invoque on all items?
    await this.hooks.runPreHooks('move', member, dbConnection, {
      source: item,
      destinationParent: parentItem,
    });

    const destination = await this._move(dbConnection, member, item, parentItem);
    await this.hooks.runPostHooks('move', member, dbConnection, {
      source: item,
      sourceParentId: getParentFromPath(item.path),
      // QUESTION: send notification for root item?
      destination,
    });

    try {
      // Check if published from moved item up to tree root
      const published = await this.itemPublishedRepository.getForItem(
        dbConnection,
        destination.path,
      );

      if (published) {
        // destination or moved item is published, we must update the index
        // update index from published
        await this.meilisearchWrapper.indexOne(dbConnection, published);
      } else {
        // nothing published, we must delete if it exists in index
        await this.meilisearchWrapper.deleteOne(dbConnection, destination);
      }
    } catch (e) {
      this.log.error(e);
      this.log.error('Error during indexation, Meilisearch may be down');
    }

    return { item, moved: destination };
  }

  // TODO: optimize
  async moveMany(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemIds: string[],
    toItemId?: string,
  ) {
    let parentItem: FolderItem | undefined = undefined;
    if (toItemId) {
      parentItem = (await this.basicItemService.get(
        dbConnection,
        member,
        toItemId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(
      itemIds.map((id) => this.move(dbConnection, member, id, parentItem)),
    );

    // newly moved items needs rescaling since they are added in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(dbConnection, member, parentItem);
    }

    return {
      items: results.map(({ item }) => item),
      moved: results.map(({ moved }) => moved),
    };
  }

  /**
   * Does the work of moving the item and the necessary changes to all the item memberships
   * involved.
   *
   * `this.itemMembershipService.moveHousekeeping()` runs first because membership paths
   * are *automatically* updated (`ON UPDATE CASCADE`) with `this.itemService.move()` and the
   * "adjustments" need to be calculated before - considering the origin membership paths.
   *
   * * `inserts`' `itemPath`s already have the expected paths for the destination;
   * * `deletes`' `itemPath`s have the path changes after `this.itemService.move()`.
   */
  async _move(
    dbConnection: DBConnection,
    actor: MinimalMember,
    item: Item,
    parentItem?: FolderItem,
  ) {
    // identify all the necessary adjustments to memberships
    // TODO: maybe this whole 'magic' should happen in a db procedure?
    const { inserts, deletes } = await this.itemMembershipRepository.moveHousekeeping(
      dbConnection,
      item,
      actor,
      parentItem,
    );

    const result = await this.itemRepository.move(dbConnection, item, parentItem);
    // adjust memberships to keep the constraints
    if (inserts.length) {
      await this.itemMembershipRepository.addMany(dbConnection, inserts);
    }

    if (deletes.length) {
      await this.itemMembershipRepository.deleteManyByItemPathAndAccount(dbConnection, deletes);
    }

    return result;
  }

  /////// -------- COPY
  async copy(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    parentItem?: FolderItem,
  ) {
    const item = await this.basicItemService.get(dbConnection, member, itemId);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        dbConnection,
        item,
      );
      // this function is not a promise!
      this.itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(
      dbConnection,
      item,
      MAX_DESCENDANTS_FOR_COPY,
    );

    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(dbConnection, item);
      items = [...descendants, item];
    }

    // pre hook
    for (const original of items) {
      await this.hooks.runPreHooks('copy', member, dbConnection, { original });
    }

    let siblings: string[] = [];
    let startWith: string = item.name;
    if (IS_COPY_REGEX.test(startWith)) {
      const suffixStart = startWith.lastIndexOf('(');
      startWith = startWith.substring(0, suffixStart);
    }

    startWith = startWith.substring(0, MAX_ITEM_NAME_LENGTH - MAX_COPY_SUFFIX_LENGTH);

    if (parentItem) {
      siblings = await this.itemRepository.getChildrenNames(dbConnection, parentItem, {
        startWith,
      });
    } else {
      siblings = await this.itemMembershipRepository.getAccessibleItemNames(dbConnection, member, {
        startWith,
      });
    }

    const { copyRoot, treeCopyMap } = await this.itemRepository.copy(
      dbConnection,
      item,
      member,
      siblings,
      parentItem,
    );

    // create a membership if needed
    await this.itemMembershipRepository
      .addOne(dbConnection, {
        itemPath: copyRoot.path,
        accountId: member.id,
        creatorId: member.id,
        permission: PermissionLevel.Admin,
      })
      .catch((e) => {
        // admin permission already exists and does not need to be added
        if (e instanceof InvalidMembership) {
          return;
        }
        throw e;
      });

    // post hook
    for (const { original, copy } of treeCopyMap.values()) {
      await this.hooks.runPostHooks('copy', member, dbConnection, {
        original,
        copy,
      });

      // copy hidden visibility
      await this.itemVisibilityRepository.copyAll(dbConnection, member, original, copy.path, [
        ItemVisibilityType.Public,
      ]);

      // copy geolocation
      await this.itemGeolocationRepository.copy(dbConnection, original, copy);
      // copy thumbnails if original has setting to true
      if (original.settings.hasThumbnail) {
        try {
          // try to copy thumbnails, this might fail, so we wrap in a try-catch
          await this.thumbnailService.copyFolder(member, {
            originalId: original.id,
            newId: copy.id,
          });
        } catch {
          this.log.error(`On item copy, thumbnail for ${original.id} could not be found.`);
        }
      }
    }

    // index copied root if copied in a published item
    if (parentItem) {
      const published = await this.itemPublishedRepository.getForItem(
        dbConnection,
        parentItem.path,
      );
      if (published) {
        await this.meilisearchWrapper.indexOne(dbConnection, published);
      }
    }

    return { item, copy: copyRoot };
  }

  // TODO: optimize
  async copyMany(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemIds: string[],
    args: { parentId?: UUID },
  ) {
    let parentItem: FolderItem | undefined;
    if (args.parentId) {
      parentItem = (await this.basicItemService.get(
        dbConnection,
        member,
        args.parentId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(
      itemIds.map((id) => this.copy(dbConnection, member, id, parentItem)),
    );

    // rescale order because copies happen in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(dbConnection, member, parentItem);
    }

    return {
      items: results.map(({ item }) => item),
      copies: results.map(({ copy }) => copy),
    };
  }

  async reorder(
    dbConnection: DBConnection,
    actor: MinimalMember,
    itemId: string,
    body: { previousItemId?: string },
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    const ids = getIdsFromPath(item.path);

    // cannot reorder root item
    if (ids.length <= 1) {
      throw new CannotReorderRootItem(item.id);
    }

    const parentPath = buildPathFromIds(...ids.slice(0, -1));

    return this.itemRepository.reorder(dbConnection, item, parentPath, body.previousItemId);
  }

  /**
   * Rescale order of children (of itemId's parent) if necessary
   * @param member
   * @param itemId item whose parent get its children order rescaled if necessary
   */
  async rescaleOrderForParent(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    item: ItemRaw,
  ) {
    const parentId = getParentFromPath(item.path);
    if (parentId) {
      const parentItem = (await this.basicItemService.get(
        dbConnection,
        member,
        parentId,
      )) as FolderItem;
      await this.itemRepository.rescaleOrder(dbConnection, member, parentItem);
    }
  }
}
