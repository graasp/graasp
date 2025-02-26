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

import { DBConnection } from '../../drizzle/db';
import { Item, ItemMembership, Member } from '../../drizzle/schema';
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
import {
  AuthorizationService,
  filterOutItems,
  filterOutPackedDescendants,
  filterOutPackedItems,
} from '../authorization';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { ThumbnailService } from '../thumbnail/service';
import { mapById } from '../utils';
import { ItemWrapper, PackedItem } from './ItemWrapper';
import { IS_COPY_REGEX, MAX_COPY_SUFFIX_LENGTH } from './constants';
import { FolderItem, isItemType } from './entities/Item';
import { ItemGeolocation } from './plugins/geolocation/ItemGeolocation';
import { PartialItemGeolocation } from './plugins/geolocation/errors';
import { ItemGeolocationRepository } from './plugins/geolocation/repository';
import { ItemVisibility } from './plugins/itemVisibility/ItemVisibility';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch';
import { ItemPublishedRepository } from './plugins/publication/published/repositories/itemPublished';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemRepository } from './repository';
import { ItemChildrenParams, ItemSearchParams } from './types';

@singleton()
export class ItemService {
  private readonly log: BaseLogger;
  private readonly thumbnailService: ThumbnailService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  private readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;

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
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizationService: AuthorizationService,
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
    this.log = log;
  }

  async post(
    db: DBConnection,
    member: AuthenticatedUser,
    args: {
      item: Partial<Item> & Pick<Item, 'name' | 'type'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ) {
    const { item, parentId, geolocation, thumbnail } = args;

    // name and type should exist
    if (!item.name || !item.type) {
      throw new MissingNameOrTypeForItemError(item);
    }

    // lat and lng should exist together
    const { lat, lng } = geolocation || {};
    if ((lat && !lng) || (lng && !lat)) {
      throw new PartialItemGeolocation({ lat, lng });
    }

    this.log.debug(`run prehook for ${item.name}`);
    await this.hooks.runPreHooks('create', member, db, { item }, this.log);

    let inheritedMembership;
    let parentItem: Item | undefined = undefined;
    // TODO: HOOK?
    // check permission over parent
    if (parentId) {
      this.log.debug(`verify parent ${parentId} exists and has permission over it`);
      parentItem = await this.get(db, member, parentId, PermissionLevel.Write);
      inheritedMembership = await this.itemMembershipRepository.getInherited(
        db,
        parentItem.path,
        member.id,
        true,
      );

      // quick check, necessary for ts
      if (parentItem.type !== ItemType.FOLDER) {
        throw new ItemNotFolder(parentItem);
      }

      this.itemRepository.checkHierarchyDepth(parentItem);

      // check if there's too many children under the same parent
      const descendants = await this.itemRepository.getChildren(db, member, parentItem);
      if (descendants.length + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }

      // no previous item adds at the beginning
      if (!args.previousItemId) {
        item.order = await this.itemRepository.getFirstOrderValue(db, parentItem.path);
      }
      // define order, from given previous item id if exists
      else {
        item.order = await this.itemRepository.getNextOrderCount(
          db,
          parentItem.path,
          args.previousItemId,
        );
      }
    }

    this.log.debug(`create item ${item.name}`);
    const createdItem = await this.itemRepository.addOne(db, {
      item,
      creator: member,
      parentItem,
    });
    this.log.debug(`item ${item.name} is created: ${createdItem}`);

    // create membership if inherited is less than admin
    if (
      !inheritedMembership ||
      PermissionLevelCompare.lt(inheritedMembership?.permission, PermissionLevel.Admin)
    ) {
      this.log.debug(`create membership for ${createdItem.id}`);
      await this.itemMembershipRepository.addOne({
        itemPath: createdItem.path,
        accountId: member.id,
        creatorId: member.id,
        permission: PermissionLevel.Admin,
      });
    }

    this.log.debug(`run posthook for ${createdItem.id}`);
    await this.hooks.runPostHooks('create', member, db, { item: createdItem }, this.log);

    // geolocation
    if (geolocation) {
      await this.itemGeolocationRepository.put(db, createdItem.path, geolocation);
    }

    // thumbnail
    if (thumbnail) {
      await this.thumbnailService.upload(db, member, createdItem.id, thumbnail);
      await this.patch(db, member, createdItem.id, {
        settings: { hasThumbnail: true },
      });
      // set in the item
      createdItem.settings = { hasThumbnail: true };
    }
    return createdItem;
  }

  /**
   * internally get for an item
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  private async _get(
    db: DBConnection,
    actor: Actor,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const item = await this.itemRepository.getOneOrThrow(db, id);

    const { itemMembership, visibilities } = await this.authorizationService.validatePermission(
      db,
      permission,
      actor,
      item,
    );
    return { item, itemMembership, visibilities };
  }

  /**
   * get for an item
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async get(
    db: DBConnection,
    actor: Actor,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const { item } = await this._get(db, actor, id, permission);

    return item;
  }

  /**
   * get an item packed with complementary info
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async getPacked(
    db: DBConnection,
    actor: Actor,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const { item, itemMembership, visibilities } = await this._get(db, actor, id, permission);
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
    db: DBConnection,
    actor: Actor,
    ids: string[],
  ): Promise<{
    items: ResultOf<Item>;
    itemMemberships: ResultOf<ItemMembership | null>;
    visibilities: ResultOf<ItemVisibility[] | null>;
  }> {
    const result = await this.itemRepository.getMany(db, ids);
    // check memberships
    // remove items if they do not have permissions
    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        db,
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
  async getMany(db: DBConnection, actor: Actor, ids: string[]) {
    const { items, itemMemberships } = await this._getMany(db, actor, ids);

    return { data: items.data, errors: items.errors.concat(itemMemberships?.errors ?? []) };
  }

  /**
   * get item packed with complementary items
   * @param actor
   * @param repositories
   * @param ids
   * @returns
   */
  async getManyPacked(db: DBConnection, actor: Actor, ids: string[]) {
    const { items, itemMemberships, visibilities } = await this._getMany(db, actor, ids);

    const thumbnails = await this.itemThumbnailService.getUrlsByItems(Object.values(items.data));

    return ItemWrapper.mergeResult(items, itemMemberships, visibilities, thumbnails);
  }

  async getAccessible(
    db: DBConnection,
    member: Member,
    params: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<PackedItem>> {
    const { data: memberships, totalCount } =
      await this.itemMembershipRepository.getAccessibleItems(db, member, params, pagination);

    const items = memberships.map(({ item }) => item);
    const resultOfMembership = mapById<ItemMembership[]>({
      keys: items.map((i) => i.id),
      findElement: (id) => {
        const im = memberships.find(({ item: thisItem }) => thisItem.id === id);
        return im ? [im] : undefined;
      },
    });

    const packedItems = await ItemWrapper.createPackedItems(
      db,
      member,
      this.itemThumbnailService,
      memberships.map(({ item }) => item),
      resultOfMembership,
    );
    return { data: packedItems, totalCount, pagination };
  }

  async getOwn(db: DBConnection, member: Member) {
    return this.itemRepository.getOwn(db, member.id);
  }

  async getShared(db: DBConnection, member: Member, permission?: PermissionLevel) {
    const items = await this.itemMembershipRepository.getSharedItems(member.id, permission);
    // TODO optimize?
    return filterOutItems(db, member, items);
  }

  private async _getChildren(
    db: DBConnection,
    actor: Actor,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    return itemRepository.getChildren(actor, item, params);
  }

  async getChildren(db: DBConnection, actor: Actor, itemId: string, params?: ItemChildrenParams) {
    const children = await this._getChildren(actor, repositories, itemId, params);
    // TODO optimize?
    return filterOutItems(actor, repositories, children);
  }

  async getPackedChildren(
    db: DBConnection,
    actor: Actor,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(actor, repositories, itemId, params);
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(children);

    // TODO optimize?
    return filterOutPackedItems(actor, repositories, children, thumbnails);
  }

  private async getDescendants(
    db: DBConnection,
    actor: Actor,
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

  async getFilteredDescendants(db: DBConnection, account: Account, itemId: UUID) {
    const { descendants } = await this.getDescendants(account, repositories, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(account, repositories, descendants);
  }

  async getPackedDescendants(
    db: DBConnection,
    actor: Actor,
    itemId: UUID,
    options?: { showHidden?: boolean; types?: string[] },
  ) {
    const { descendants, item } = await this.getDescendants(db, actor, itemId, options);
    if (!descendants.length) {
      return [];
    }
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(descendants);
    return filterOutPackedDescendants(db, actor, item, descendants, thumbnails, options);
  }

  async getParents(db: DBConnection, actor: Actor, itemId: UUID) {
    const item = await this.get(db, actor, itemId);
    const parents = await this.itemRepository.getAncestors(db, item);

    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        db,
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

  async patch(db: DBConnection, member: Member, itemId: UUID, body: DeepPartial<Item>) {
    // check memberships
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    await this.authorizationService.validatePermission(
      db,

      PermissionLevel.Write,
      member,
      item,
    );

    await this.hooks.runPreHooks('update', member, repositories, { item: item });

    const updated = await this.itemRepository.updateOne(db, item.id, body);

    await this.hooks.runPostHooks('update', member, repositories, { item: updated });

    return updated;
  }

  // QUESTION? DELETE BY PATH???
  async delete(db: DBConnection, actor: Member, itemId: UUID) {
    // check memberships
    const item = await this.itemRepository.getDeletedById(db, itemId);
    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);

    // check how "big the tree is" below the item
    // we do not use checkNumberOfDescendants because we use descendants
    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(db, item, { ordered: false });
      if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
        throw new TooManyDescendants(itemId);
      }
      items = [...descendants, item];
    }

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, repositories, { item });
    }

    await this.itemRepository.delete(
      db,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(db: DBConnection, actor: Member, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check memberships
    // can get soft deleted items
    // QUESTION: move to recycle bin and the endpoint can only delete recycled items
    const { data: itemsMap } = await this.itemRepository.getMany(db, itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const allItems = Object.values(itemsMap);

    // TODO: optimize
    const allDescendants = await Promise.all(
      allItems.map(async (item) => {
        await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);
        if (!isItemType(item, ItemType.FOLDER)) {
          return [];
        }
        // check how "big the tree is" below the item
        // we do not use checkNumberOfDescendants because we use descendants
        const descendants = await this.itemRepository.getDescendants(db, item, { ordered: false });
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

    await this.itemRepository.delete(
      db,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return allItems;
  }

  /////// -------- MOVE
  async move(db: DBConnection, member: Member, itemId: UUID, parentItem?: FolderItem) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, member, item);

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(db, item, MAX_DESCENDANTS_FOR_MOVE);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        db,
        item,
      );
      await this.itemRepository.checkHierarchyDepth(db, parentItem, levelsToFarthestChild);
    }

    // post hook
    // question: invoque on all items?
    await this.hooks.runPreHooks('move', member, repositories, {
      source: item,
      destinationParent: parentItem,
    });

    const result = await this._move(db, member, item, parentItem);

    await this.hooks.runPostHooks('move', member, repositories, {
      source: item,
      sourceParentId: getParentFromPath(item.path),
      destination: result,
    });

    return { item, moved: result };
  }

  // TODO: optimize
  async moveMany(db: DBConnection, member: Member, itemIds: string[], toItemId?: string) {
    let parentItem: FolderItem | undefined = undefined;
    if (toItemId) {
      parentItem = (await this.get(db, member, toItemId, PermissionLevel.Write)) as FolderItem;
    }

    const results = await Promise.all(itemIds.map((id) => this.move(db, member, id, parentItem)));

    // newly moved items needs rescaling since they are added in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(db, member, parentItem);
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
  async _move(db: DBConnection, actor: Member, item: Item, parentItem?: Item) {
    // identify all the necessary adjustments to memberships
    // TODO: maybe this whole 'magic' should happen in a db procedure?
    const { inserts, deletes } = await this.itemMembershipRepository.moveHousekeeping(
      db,
      item,
      actor,
      parentItem,
    );

    const result = await this.itemRepository.move(db, item, parentItem);

    // adjust memberships to keep the constraints
    if (inserts.length) {
      await this.itemMembershipRepository.addMany(db, inserts);
    }
    if (deletes.length) {
      await this.itemMembershipRepository.deleteManyByItemPathAndAccount(db, deletes);
    }

    return result;
  }

  /////// -------- COPY
  async copy(db: DBConnection, member: Member, itemId: UUID, parentItem?: FolderItem) {
    const item = await this.get(db, member, itemId);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        db,
        item,
      );
      await this.itemRepository.checkHierarchyDepth(db, parentItem, levelsToFarthestChild);
    }

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(db, item, MAX_DESCENDANTS_FOR_COPY);

    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(db, item, { ordered: false });
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
      siblings = await this.itemRepository.getChildrenNames(db, parentItem, { startWith });
    } else {
      siblings = await this.itemMembershipRepository.getAccessibleItemNames(db, member, {
        startWith,
      });
    }

    const { copyRoot, treeCopyMap } = await this.itemRepository.copy(
      item,
      member,
      siblings,
      parentItem,
    );

    // create a membership if needed
    await this.itemMembershipRepository
      .addOne(db, {
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
      await this.itemVisibilityRepository.copyAll(db, member, original, copy, [
        ItemVisibilityType.Public,
      ]);

      // copy geolocation
      await this.itemGeolocationRepository.copy(db, original, copy);
      // copy thumbnails if original has setting to true
      if (original.settings.hasThumbnail) {
        try {
          // try to copy thumbnails, this might fail, so we wrap in a try-catch
          await this.thumbnailService.copyFolder(db, member, {
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
      const published = await this.itemPublishedRepository.getForItem(db, parentItem);
      if (published) {
        await this.meilisearchWrapper.indexOne(db, published);
      }
    }

    return { item, copy: copyRoot };
  }

  // TODO: optimize
  async copyMany(db: DBConnection, member: Member, itemIds: string[], args: { parentId?: UUID }) {
    let parentItem: FolderItem | undefined;
    if (args.parentId) {
      parentItem = (await this.get(db, member, args.parentId, PermissionLevel.Write)) as FolderItem;
    }

    const results = await Promise.all(itemIds.map((id) => this.copy(db, member, id, parentItem)));

    // rescale order because copies happen in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(member, parentItem);
    }

    return { items: results.map(({ item }) => item), copies: results.map(({ copy }) => copy) };
  }

  async reorder(
    db: DBConnection,
    actor: Member,
    itemId: string,
    body: { previousItemId?: string },
  ) {
    const item = await this.get(db, actor, itemId);

    const ids = getIdsFromPath(item.path);

    // cannot reorder root item
    if (ids.length <= 1) {
      throw new CannotReorderRootItem(item.id);
    }

    const parentPath = buildPathFromIds(...ids.slice(0, -1));

    return this.itemRepository.reorder(db, item, parentPath, body.previousItemId);
  }

  /**
   * Rescale order of children (of itemId's parent) if necessary
   * @param member
   * @param repositories
   * @param itemId item whose parent get its children order rescaled if necessary
   */
  async rescaleOrderForParent(db: DBConnection, member: Member, item: Item) {
    const parentId = getParentFromPath(item.path);
    if (parentId) {
      const parentItem = await this.get(db, member, parentId);
      await this.itemRepository.rescaleOrder(db, member, parentItem);
    }
  }
}
