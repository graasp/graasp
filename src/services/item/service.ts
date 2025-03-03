import { Readable } from 'stream';
import { singleton } from 'tsyringe';
import { DeepPartial } from 'typeorm';

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
  ResultOf,
  UUID,
  buildPathFromIds,
  getIdsFromPath,
  getParentFromPath,
} from '@graasp/sdk';

import { BaseLogger } from '../../logger';
import { AuthenticatedUser } from '../../types';
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
import { Repositories } from '../../utils/repositories';
import {
  filterOutItems,
  filterOutPackedDescendants,
  filterOutPackedItems,
  validatePermission,
  validatePermissionMany,
} from '../authorization';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor, Member } from '../member/entities/member';
import { ThumbnailService } from '../thumbnail/service';
import { mapById } from '../utils';
import { ItemWrapper, PackedItem } from './ItemWrapper';
import { IS_COPY_REGEX, MAX_COPY_SUFFIX_LENGTH } from './constants';
import { DEFAULT_ORDER, FolderItem, Item, isItemType } from './entities/Item';
import { ItemGeolocation } from './plugins/geolocation/ItemGeolocation';
import { ItemGeolocationRepository } from './plugins/geolocation/repository';
import { ItemVisibility } from './plugins/itemVisibility/ItemVisibility';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemChildrenParams, ItemSearchParams } from './types';

@singleton()
export class ItemService {
  private readonly log: BaseLogger;
  private readonly thumbnailService: ThumbnailService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly itemThumbnailService: ItemThumbnailService;

  hooks = new HookManager<{
    create: { pre: { item: Partial<Item> }; post: { item: Item } };
    update: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
    copy: { pre: { original: Item }; post: { original: Item; copy: Item } };
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
    itemThumbnailService: ItemThumbnailService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    this.thumbnailService = thumbnailService;
    this.itemThumbnailService = itemThumbnailService;
    this.meilisearchWrapper = meilisearchWrapper;
    this.log = log;
  }

  /**
   * Post a single item
   */
  async post(
    member: Member,
    repositories: Repositories,
    args: {
      item: Partial<Item> & Pick<Item, 'name' | 'type'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ): Promise<Item> {
    const { item, parentId, previousItemId, geolocation, thumbnail } = args;

    // item
    // take the first and (must be) the only item
    const createdItems = await this.createItems(
      member,
      repositories,
      [item],
      parentId,
      previousItemId,
    );

    const [updatedItem] = await this.saveGeolocationsAndThumbnails(
      member,
      repositories,
      [{ item, geolocation, thumbnail }],
      createdItems,
    );

    return updatedItem;
  }

  /**
   * Post multiple items, with optional geolocations and thumbnails.
   */
  async postMany(
    member: Member,
    repositories: Repositories,
    args: {
      items: {
        item: Partial<Item> & Pick<Item, 'name' | 'type'>;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        thumbnail?: Readable;
      }[];
      parentId: string;
    },
  ): Promise<Item[]> {
    const { items: inputItems, parentId } = args;

    // create items
    const itemsToInsert = inputItems.map((i) => i.item);
    const createdItems = await this.createItems(member, repositories, itemsToInsert, parentId);

    return this.saveGeolocationsAndThumbnails(member, repositories, inputItems, createdItems);
  }

  private async saveGeolocationsAndThumbnails(
    member: Member,
    repositories: Repositories,
    inputItems: {
      item: Partial<Item> & Pick<Item, 'name' | 'type'>;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
    }[],
    createdItems: Item[],
  ) {
    const { itemGeolocationRepository } = repositories;

    // get the ordered items from the db
    // to get them in the same order as the input item array
    const insertedItems = await repositories.itemRepository.getMany(
      createdItems.map((i) => i.id),
      { ordered: true },
    );

    // construct geolocation and thumbnail maps
    const orderedItems = Object.values(insertedItems.data);
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
    await this.saveGeolocations(itemGeolocationRepository, geolocations);

    // upload thumbnails
    return this.uploadThumbnails(member, repositories, createdItems, thumbnails);
  }

  /**
   * Creates the given items in the DB.
   * @param parentId Parent for the given items, if defined
   * @param previousItemId Defines the order of the items, if defined
   * @returns An unordered list of inserted items
   */
  private async createItems(
    member: Member,
    repositories: Repositories,
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
        member,
        repositories,
        items,
        parentId,
        previousItemId,
      );
    } else {
      createdItems = await this.createItemsAndMemberships(member, repositories, items, null);
    }

    // index the items for search
    this.indexItemsForSearch(createdItems, repositories);

    return createdItems;
  }

  /**
   * Creates items under a certain parent in the DB.
   * @param previousItemId Defines the order of the items, if present
   * @returns An unordered list of inserted items
   */
  private async createItemsWithParent(
    member: Member,
    repositories: Repositories,
    items: (Partial<Item> & Pick<Item, 'name' | 'type'>)[],
    parentId: string,
    previousItemId?: string,
  ) {
    const { itemRepository, itemMembershipRepository } = repositories;

    this.log.debug(`verify parent ${parentId} exists and the member has permission over it`);
    const parentItem = await this.get(member, repositories, parentId, PermissionLevel.Write);
    const inheritedMembership = await itemMembershipRepository.getInherited(
      parentItem.path,
      member.id,
      true,
    );

    // quick check, necessary for ts
    if (!isItemType(parentItem, ItemType.FOLDER)) {
      throw new ItemNotFolder(parentItem);
    }

    itemRepository.checkHierarchyDepth(parentItem);

    // check if there's too many children under the same parent
    const descendants = await itemRepository.getChildren(member.lang, parentItem);
    if (descendants.length + items.length > MAX_NUMBER_OF_CHILDREN) {
      throw new TooManyChildren();
    }

    // no previous item adds at the beginning
    // else define order from given previous item id
    let order;
    if (!previousItemId) {
      order = await repositories.itemRepository.getFirstOrderValue(parentItem.path);
    } else {
      order = await repositories.itemRepository.getNextOrderCount(parentItem.path, previousItemId);
    }
    for (let i = 0; i < items.length; i++) {
      items[i] = { ...items[i], order };
      order += DEFAULT_ORDER;
    }

    const createdItems = await this.createItemsAndMemberships(
      member,
      repositories,
      items,
      inheritedMembership,
      parentItem,
    );

    // rescale the item ordering, if there's more than one item
    if (items.length > 1) {
      repositories.itemRepository.rescaleOrder(member, parentItem);
    }

    return createdItems;
  }

  /**
   * Creates items and its associated memberships in the DB
   * @returns An unordered list of inserted items
   */
  private async createItemsAndMemberships(
    member: Member,
    repositories: Repositories,
    items: (Partial<Item> & Pick<Item, 'name' | 'type'>)[],
    inheritedMembership: ItemMembership | null,
    parentItem?: Item,
  ) {
    const { itemRepository, itemMembershipRepository } = repositories;

    this.log.debug(`create items ${items.map((item) => item.name)}`);
    const createdItems = await itemRepository.addMany(items, member, parentItem);
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
      await itemMembershipRepository.addMany(memberships);
    }

    return createdItems;
  }

  /**
   * Save the geolocations in the repository.
   * @param geolocations Key-value map with the item path ID as key
   */
  private async saveGeolocations(
    itemGeolocationRepository: ItemGeolocationRepository,
    geolocations: { [key: string]: Pick<ItemGeolocation, 'lat' | 'lng'> },
  ) {
    return Promise.all(
      Object.keys(geolocations).map(async (itemPath) => {
        const geolocation = geolocations[itemPath];
        if (geolocation) {
          return itemGeolocationRepository.put(itemPath, geolocations[itemPath]);
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
    member: Member,
    repositories: Repositories,
    createdItems: Item[],
    thumbnails: { [key: string]: Readable },
  ): Promise<Item[]> {
    return Promise.all(
      createdItems.map(async (item) => {
        const thumbnail = thumbnails[item.id];
        if (thumbnail) {
          await this.thumbnailService.upload(member, item.id, thumbnail);
          return this.patch(member, repositories, item.id, {
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
  private async indexItemsForSearch(items: Item[], repositories: Repositories) {
    try {
      // Check if the item is published (or has published parent)
      const { data: publishedInfo } = await repositories.itemPublishedRepository.getForItems(items);

      if (publishedInfo.length) {
        return;
      }

      // update index
      await this.meilisearchWrapper.index(Object.values(publishedInfo), repositories);
    } catch (e) {
      this.log.error('Error during indexation, Meilisearch may be down');
    }
  }

  /**
   * internally get for an item
   * @param actor
   * @param repositories
   * @param id
   * @param permission
   * @returns
   */
  private async _get(
    actor: Actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const item = await repositories.itemRepository.getOneOrThrow(id);

    const { itemMembership, visibilities } = await validatePermission(
      repositories,
      permission,
      actor,
      item,
    );
    return { item, itemMembership, visibilities };
  }

  /**
   * get for an item
   * @param actor
   * @param repositories
   * @param id
   * @param permission
   * @returns
   */
  async get(
    actor: Actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const { item } = await this._get(actor, repositories, id, permission);

    return item;
  }

  /**
   * get an item packed with complementary info
   * @param actor
   * @param repositories
   * @param id
   * @param permission
   * @returns
   */
  async getPacked(
    actor: Actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const { item, itemMembership, visibilities } = await this._get(
      actor,
      repositories,
      id,
      permission,
    );
    const thumbnails = await this.itemThumbnailService.getUrlsByItems([item]);

    return new ItemWrapper(item, itemMembership, visibilities, thumbnails[item.id]).packed();
  }

  /**
   * internally get generic items
   * @param actor
   * @param repositories
   * @param ids
   * @returns result of items given ids
   */
  private async _getMany(
    actor: Actor,
    repositories: Repositories,
    ids: string[],
  ): Promise<{
    items: ResultOf<Item>;
    itemMemberships: ResultOf<ItemMembership | null>;
    visibilities: ResultOf<ItemVisibility[] | null>;
  }> {
    const { itemRepository } = repositories;
    const result = await itemRepository.getMany(ids);
    // check memberships
    // remove items if they do not have permissions
    const { itemMemberships, visibilities } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      Object.values(result.data),
    );

    for (const [id, _item] of Object.entries(result.data)) {
      // Do not delete if value exist but is null, because no memberships but can be public
      if (itemMemberships?.data[id] === undefined) {
        delete result.data[id];
      }
    }

    return { items: result, itemMemberships, visibilities };
  }

  /**
   * get generic items
   * @param actor
   * @param repositories
   * @param ids
   * @returns
   */
  async getMany(actor: Actor, repositories: Repositories, ids: string[]) {
    const { items, itemMemberships } = await this._getMany(actor, repositories, ids);

    return { data: items.data, errors: items.errors.concat(itemMemberships?.errors ?? []) };
  }

  /**
   * get item packed with complementary items
   * @param actor
   * @param repositories
   * @param ids
   * @returns
   */
  async getManyPacked(actor: Actor, repositories: Repositories, ids: string[]) {
    const { items, itemMemberships, visibilities } = await this._getMany(actor, repositories, ids);

    const thumbnails = await this.itemThumbnailService.getUrlsByItems(Object.values(items.data));

    return ItemWrapper.mergeResult(items, itemMemberships, visibilities, thumbnails);
  }

  async getAccessible(
    member: Member,
    repositories: Repositories,
    params: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<PackedItem>> {
    const { data: memberships, totalCount } =
      await repositories.itemMembershipRepository.getAccessibleItems(member, params, pagination);

    const items = memberships.map(({ item }) => item);
    const resultOfMembership = mapById<ItemMembership[]>({
      keys: items.map((i) => i.id),
      findElement: (id) => {
        const im = memberships.find(({ item: thisItem }) => thisItem.id === id);
        return im ? [im] : undefined;
      },
    });

    const packedItems = await ItemWrapper.createPackedItems(
      member,
      repositories,
      this.itemThumbnailService,
      memberships.map(({ item }) => item),
      resultOfMembership,
    );
    return { data: packedItems, totalCount, pagination };
  }

  async getOwn(member: Member, { itemRepository }: Repositories) {
    return itemRepository.getOwn(member.id);
  }

  async getShared(member: Member, repositories: Repositories, permission?: PermissionLevel) {
    const { itemMembershipRepository } = repositories;
    const items = await itemMembershipRepository.getSharedItems(member.id, permission);
    // TODO optimize?
    return filterOutItems(member, repositories, items);
  }

  private async _getChildren(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    return itemRepository.getChildren(actor?.lang, item, params);
  }

  async getChildren(actor: Actor, repositories: Repositories, itemId: string) {
    const children = await this._getChildren(actor, repositories, itemId);
    // TODO optimize?
    return filterOutItems(actor, repositories, children);
  }

  async getPackedChildren(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(actor, repositories, itemId, params);
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(children);

    // TODO optimize?
    return filterOutPackedItems(actor, repositories, children, thumbnails);
  }

  private async getDescendants(
    actor: Actor,
    repositories: Repositories,
    itemId: UUID,
    options?: { types?: string[] },
  ) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    if (!isItemType(item, ItemType.FOLDER)) {
      return { item, descendants: [] };
    }

    return { item, descendants: await itemRepository.getDescendants(item, options) };
  }

  async getFilteredDescendants(
    account: AuthenticatedUser,
    repositories: Repositories,
    itemId: UUID,
  ) {
    const { descendants } = await this.getDescendants(account, repositories, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(account, repositories, descendants);
  }

  async getPackedDescendants(
    actor: Actor,
    repositories: Repositories,
    itemId: UUID,
    options?: { showHidden?: boolean; types?: string[] },
  ) {
    const { descendants, item } = await this.getDescendants(actor, repositories, itemId, options);
    if (!descendants.length) {
      return [];
    }
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(descendants);
    return filterOutPackedDescendants(actor, repositories, item, descendants, thumbnails, options);
  }

  async getParents(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);
    const parents = await itemRepository.getAncestors(item);

    const { itemMemberships, visibilities } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      parents,
    );
    // remove parents actor does not have access
    const parentsIds = Object.keys(itemMemberships.data);
    const items = parents.filter((p) => parentsIds.includes(p.id));
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(items);
    return ItemWrapper.merge(items, itemMemberships, visibilities, thumbnails);
  }

  async patch(member: Member, repositories: Repositories, itemId: UUID, body: DeepPartial<Item>) {
    const { itemRepository } = repositories;

    // check memberships
    const item = await itemRepository.getOneOrThrow(itemId);

    await validatePermission(repositories, PermissionLevel.Write, member, item);

    await this.hooks.runPreHooks('update', member, repositories, { item: item });

    const updated = await itemRepository.updateOne(item.id, body);

    await this.hooks.runPostHooks('update', member, repositories, { item: updated });

    return updated;
  }

  // QUESTION? DELETE BY PATH???
  async delete(actor: Member, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    // check memberships
    const item = await itemRepository.getOneOrThrow(itemId, { withDeleted: true });
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // check how "big the tree is" below the item
    // we do not use checkNumberOfDescendants because we use descendants
    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await itemRepository.getDescendants(item, { ordered: false });
      if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
        throw new TooManyDescendants(itemId);
      }
      items = [...descendants, item];
    }

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, repositories, { item });
    }

    await itemRepository.delete(items.map((i) => i.id));

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(actor: Member, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember();
    }

    const { itemRepository } = repositories;
    // check memberships
    // can get soft deleted items
    // QUESTION: move to recycle bin and the endpoint can only delete recycled items
    const { data: itemsMap } = await itemRepository.getMany(itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const allItems = Object.values(itemsMap);

    // TODO: optimize
    const allDescendants = await Promise.all(
      allItems.map(async (item) => {
        await validatePermission(repositories, PermissionLevel.Admin, actor, item);
        if (!isItemType(item, ItemType.FOLDER)) {
          return [];
        }
        // check how "big the tree is" below the item
        // we do not use checkNumberOfDescendants because we use descendants
        const descendants = await itemRepository.getDescendants(item, { ordered: false });
        if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
          throw new TooManyDescendants(item.id);
        }
        return descendants;
      }),
    );

    const items = [...allDescendants.flat(), ...allItems];

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, repositories, { item });
    }

    await itemRepository.delete(items.map((i) => i.id));

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return allItems;
  }

  /////// -------- MOVE
  async move(member: Member, repositories: Repositories, itemId: UUID, parentItem?: FolderItem) {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    // check how "big the tree is" below the item
    await itemRepository.checkNumberOfDescendants(item, MAX_DESCENDANTS_FOR_MOVE);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await itemRepository.getNumberOfLevelsToFarthestChild(item);
      await itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // post hook
    // question: invoque on all items?
    await this.hooks.runPreHooks('move', member, repositories, {
      source: item,
      destinationParent: parentItem,
    });

    const result = await this._move(member, repositories, item, parentItem);

    await this.hooks.runPostHooks('move', member, repositories, {
      source: item,
      sourceParentId: getParentFromPath(item.path),
      destination: result,
    });

    return { item, moved: result };
  }

  // TODO: optimize
  async moveMany(member: Member, repositories: Repositories, itemIds: string[], toItemId?: string) {
    let parentItem: FolderItem | undefined = undefined;
    if (toItemId) {
      parentItem = (await this.get(
        member,
        repositories,
        toItemId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(
      itemIds.map((id) => this.move(member, repositories, id, parentItem)),
    );

    // newly moved items needs rescaling since they are added in parallel
    if (parentItem) {
      await repositories.itemRepository.rescaleOrder(member, parentItem);
    }

    return { items: results.map(({ item }) => item), moved: results.map(({ moved }) => moved) };
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
  async _move(actor: Member, repositories: Repositories, item: Item, parentItem?: Item) {
    const { itemRepository, itemMembershipRepository } = repositories;
    // identify all the necessary adjustments to memberships
    // TODO: maybe this whole 'magic' should happen in a db procedure?
    const { inserts, deletes } = await itemMembershipRepository.moveHousekeeping(
      item,
      actor,
      parentItem,
    );

    const result = await itemRepository.move(item, parentItem);

    // adjust memberships to keep the constraints
    if (inserts.length) {
      await itemMembershipRepository.addMany(inserts);
    }
    if (deletes.length) {
      await itemMembershipRepository.deleteManyByItemPathAndAccount(deletes);
    }

    return result;
  }

  /////// -------- COPY
  async copy(member: Member, repositories: Repositories, itemId: UUID, parentItem?: FolderItem) {
    const { itemRepository, itemMembershipRepository, itemGeolocationRepository } = repositories;

    const item = await this.get(member, repositories, itemId);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await itemRepository.getNumberOfLevelsToFarthestChild(item);
      await itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // check how "big the tree is" below the item
    await itemRepository.checkNumberOfDescendants(item, MAX_DESCENDANTS_FOR_COPY);

    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await itemRepository.getDescendants(item, { ordered: false });
      items = [...descendants, item];
    }

    // pre hook
    for (const original of items) {
      await this.hooks.runPreHooks('copy', member, repositories, { original });
    }

    let siblings: string[] = [];
    let startWith: string = item.name;
    if (IS_COPY_REGEX.test(startWith)) {
      const suffixStart = startWith.lastIndexOf('(');
      startWith = startWith.substring(0, suffixStart);
    }

    startWith = startWith.substring(0, MAX_ITEM_NAME_LENGTH - MAX_COPY_SUFFIX_LENGTH);

    if (parentItem) {
      siblings = await itemRepository.getChildrenNames(parentItem, { startWith });
    } else {
      siblings = await itemMembershipRepository.getAccessibleItemNames(member, { startWith });
    }

    const { copyRoot, treeCopyMap } = await itemRepository.copy(item, member, siblings, parentItem);

    // create a membership if needed
    await itemMembershipRepository
      .addOne({
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
      await this.hooks.runPostHooks('copy', member, repositories, { original, copy });

      // copy hidden visibility
      await repositories.itemVisibilityRepository.copyAll(member, original, copy, [
        ItemVisibilityType.Public,
      ]);

      // copy geolocation
      await itemGeolocationRepository.copy(original, copy);
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
      const published = await repositories.itemPublishedRepository.getForItem(parentItem);
      if (published) {
        await this.meilisearchWrapper.indexOne(published, repositories);
      }
    }

    return { item, copy: copyRoot };
  }

  // TODO: optimize
  async copyMany(
    member: Member,
    repositories: Repositories,
    itemIds: string[],
    args: { parentId?: UUID },
  ) {
    const { itemRepository } = repositories;

    let parentItem: FolderItem | undefined;
    if (args.parentId) {
      parentItem = (await this.get(
        member,
        repositories,
        args.parentId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(
      itemIds.map((id) => this.copy(member, repositories, id, parentItem)),
    );

    // rescale order because copies happen in parallel
    if (parentItem) {
      await itemRepository.rescaleOrder(member, parentItem);
    }

    return { items: results.map(({ item }) => item), copies: results.map(({ copy }) => copy) };
  }

  async reorder(
    actor: Member,
    repositories: Repositories,
    itemId: string,
    body: { previousItemId?: string },
  ) {
    const item = await this.get(actor, repositories, itemId);

    const ids = getIdsFromPath(item.path);

    // cannot reorder root item
    if (ids.length <= 1) {
      throw new CannotReorderRootItem(item.id);
    }

    const parentPath = buildPathFromIds(...ids.slice(0, -1));

    return repositories.itemRepository.reorder(item, parentPath, body.previousItemId);
  }

  /**
   * Rescale order of children (of itemId's parent) if necessary
   * @param member
   * @param repositories
   * @param itemId item whose parent get its children order rescaled if necessary
   */
  async rescaleOrderForParent(member: Member, repositories: Repositories, item: Item) {
    const parentId = getParentFromPath(item.path);
    if (parentId) {
      const parentItem = await this.get(member, repositories, parentId);
      await repositories.itemRepository.rescaleOrder(member, parentItem);
    }
  }
}
