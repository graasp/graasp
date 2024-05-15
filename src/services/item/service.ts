import { Readable } from 'stream';

import { FastifyBaseLogger } from 'fastify';

import {
  ItemType,
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_NUMBER_OF_CHILDREN,
  PermissionLevel,
  PermissionLevelCompare,
  ResultOf,
  UUID,
  getParentFromPath,
} from '@graasp/sdk';

import { Paginated, PaginationParams } from '../../types';
import {
  InvalidMembership,
  ItemNotFolder,
  MemberCannotWriteItem,
  MissingNameOrTypeForItemError,
  TooManyChildren,
  TooManyDescendants,
  UnauthorizedMember,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import {
  filterOutItems,
  filterOutPackedItems,
  validatePermission,
  validatePermissionMany,
} from '../authorization';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor, Member } from '../member/entities/member';
import { ThumbnailService } from '../thumbnail/service';
import { mapById } from '../utils';
import { ItemWrapper, PackedItem } from './ItemWrapper';
import { Item, isItemType } from './entities/Item';
import { ItemGeolocation } from './plugins/geolocation/ItemGeolocation';
import { PartialItemGeolocation } from './plugins/geolocation/errors';
import { ItemChildrenParams, ItemSearchParams } from './types';

export class ItemService {
  private log: FastifyBaseLogger;
  private thumbnailService: ThumbnailService;

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

  constructor(thumbnailService: ThumbnailService, logger: FastifyBaseLogger) {
    this.thumbnailService = thumbnailService;
    this.log = logger;
  }

  async post(
    actor: Actor,
    repositories: Repositories,
    args: {
      item: Partial<Item> & Pick<Item, 'name' | 'type'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
    },
  ): Promise<Item> {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository, itemMembershipRepository, itemGeolocationRepository } = repositories;

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
    await this.hooks.runPreHooks('create', actor, repositories, { item }, this.log);

    let inheritedMembership;
    let parentItem: Item | undefined = undefined;
    // TODO: HOOK?
    // check permission over parent
    if (parentId) {
      this.log.debug(`verify parent ${parentId} exists and has permission over it`);
      parentItem = await this.get(actor, repositories, parentId, PermissionLevel.Write);
      inheritedMembership = await itemMembershipRepository.getInherited(parentItem, actor, true);

      // quick check, necessary for ts
      if (!isItemType(parentItem, ItemType.FOLDER)) {
        throw new ItemNotFolder(parentItem.id);
      }

      itemRepository.checkHierarchyDepth(parentItem);

      // check if there's too many children under the same parent
      const descendants = await itemRepository.getChildren(parentItem);
      if (descendants.length + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }
    }

    this.log.debug(`create item ${item.name}`);
    const createdItem = await itemRepository.post(item, actor, parentItem);
    this.log.debug(`item ${item.name} is created: ${createdItem}`);

    // create membership if inherited is less than admin
    if (
      !inheritedMembership ||
      PermissionLevelCompare.lt(inheritedMembership?.permission, PermissionLevel.Admin)
    ) {
      this.log.debug(`create membership for ${createdItem.id}`);
      await itemMembershipRepository.post({
        item: createdItem,
        member: actor,
        creator: actor,
        permission: PermissionLevel.Admin,
      });
    }

    if (parentId && parentItem) {
      this.log.debug(`update parent ${parentId} children order with new child`);
      // add new item id in parent extra.folder.childrenOrder
      // the optional on "folder" is present to support legacy data where the extra might be an empty object
      const newChildrenOrder = [...(parentItem.extra.folder?.childrenOrder ?? []), createdItem.id];
      await itemRepository.patch(parentItem.id, {
        extra: { folder: { ...parentItem.extra.folder, childrenOrder: newChildrenOrder } },
      });
    }

    this.log.debug(`run posthook for ${createdItem.id}`);
    await this.hooks.runPostHooks('create', actor, repositories, { item: createdItem }, this.log);

    // geolocation
    if (geolocation) {
      await itemGeolocationRepository.put(createdItem.path, geolocation);
    }

    // thumbnail
    if (thumbnail) {
      await this.thumbnailService.upload(actor, createdItem.id, thumbnail);
      await this.patch(actor, repositories, createdItem.id, {
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
   * @param repositories
   * @param id
   * @param permission
   * @returns
   */
  async _get(
    actor: Actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const item = await repositories.itemRepository.get(id);

    const { itemMembership, tags } = await validatePermission(
      repositories,
      permission,
      actor,
      item,
    );

    return { item, itemMembership, tags };
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
    const { item, itemMembership, tags } = await this._get(actor, repositories, id, permission);

    return new ItemWrapper(item, itemMembership, tags).packed();
  }

  /**
   * internally get generic items
   * @param actor
   * @param repositories
   * @param ids
   * @returns result of items given ids
   */
  async _getMany(actor: Actor, repositories: Repositories, ids: string[]) {
    const { itemRepository } = repositories;
    const result = await itemRepository.getMany(ids);

    // check memberships
    // remove items if they do not have permissions
    const { itemMemberships, tags } = await validatePermissionMany(
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

    return { items: result, itemMemberships, tags };
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
    const { items, itemMemberships, tags } = await this._getMany(actor, repositories, ids);

    return ItemWrapper.mergeResult(items, itemMemberships, tags);
  }

  async getAccessible(
    actor: Member,
    repositories: Repositories,
    params: ItemSearchParams,
    pagination: PaginationParams,
  ): Promise<Paginated<PackedItem>> {
    const { data: memberships, totalCount } =
      await repositories.itemMembershipRepository.getAccessibleItems(actor, params, pagination);

    const items = memberships.map(({ item }) => item);
    const resultOfMembership = mapById<ItemMembership[]>({
      keys: items.map((i) => i.id),
      findElement: (id) => {
        const im = memberships.find(({ item: thisItem }) => thisItem.id === id);
        return im ? [im] : undefined;
      },
    });

    const packedItems = await ItemWrapper.createPackedItems(
      actor,
      repositories,
      memberships.map(({ item }) => item),
      resultOfMembership,
    );
    this.log.debug(packedItems);
    return { data: packedItems, totalCount };
  }

  async getOwn(actor: Actor, { itemRepository }: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    return itemRepository.getOwn(actor.id);
  }

  async getShared(actor: Actor, repositories: Repositories, permission?: PermissionLevel) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemMembershipRepository } = repositories;
    const items = await itemMembershipRepository.getSharedItems(actor.id, permission);
    // TODO optimize?
    return filterOutItems(actor, repositories, items);
  }

  async _getChildren(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    return itemRepository.getChildren(item, params);
  }

  async getChildren(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(actor, repositories, itemId, params);

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

    // TODO optimize?
    return filterOutPackedItems(actor, repositories, children);
  }

  async _getDescendants(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    if (!isItemType(item, ItemType.FOLDER)) {
      return [];
    }

    return itemRepository.getDescendants(item);
  }

  async getDescendants(actor: Actor, repositories: Repositories, itemId: UUID) {
    const descendants = await this._getDescendants(actor, repositories, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(actor, repositories, descendants);
  }

  async getPackedDescendants(actor: Actor, repositories: Repositories, itemId: UUID) {
    const descendants = await this._getDescendants(actor, repositories, itemId);
    if (!descendants.length) {
      return [];
    }
    return filterOutPackedItems(actor, repositories, descendants);
  }

  async getParents(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    const parents = await itemRepository.getAncestors(item);
    const { itemMemberships, tags } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      parents,
    );
    // remove parents actor does not have access
    const parentsIds = Object.keys(itemMemberships.data);
    const items = parents.filter((p) => parentsIds.includes(p.id));
    return ItemWrapper.merge(items, itemMemberships, tags);
  }

  async patch(actor: Actor, repositories: Repositories, itemId: UUID, body: Partial<Item>) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository } = repositories;

    // check memberships
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Write, actor, item);

    await this.hooks.runPreHooks('update', actor, repositories, { item: item });

    const updated = await itemRepository.patch(itemId, body);
    await this.hooks.runPostHooks('update', actor, repositories, { item: updated });

    return updated;
  }

  async patchMany(
    actor: Actor,
    repositories: Repositories,
    itemIds: UUID[],
    body: Partial<Item>,
  ): Promise<ResultOf<Item>> {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // TODO: extra + settings
    const ops = await Promise.all(
      itemIds.map(async (id) => this.patch(actor, repositories, id, body)),
    );

    return mapById({
      keys: itemIds,
      findElement: (id) => ops.find(({ id: thisId }) => id === thisId),
      buildError: (id) => new MemberCannotWriteItem(id),
    });
  }

  // QUESTION? DELETE BY PATH???
  async delete(actor: Member, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    // check memberships
    const item = await itemRepository.get(itemId, { withDeleted: true });
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

    await itemRepository.deleteMany(items.map((i) => i.id));

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
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

    await itemRepository.deleteMany(items.map((i) => i.id));

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return allItems;
  }

  /////// -------- MOVE
  async move(actor: Actor, repositories: Repositories, itemId: UUID, toItemId?: UUID) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository } = repositories;
    // TODO: check memberships
    let parentItem;
    if (toItemId) {
      parentItem = await itemRepository.get(toItemId);
      await validatePermission(repositories, PermissionLevel.Write, actor, parentItem);
    }
    const item = await itemRepository.get(itemId);

    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // check how "big the tree is" below the item
    await itemRepository.checkNumberOfDescendants(item, MAX_DESCENDANTS_FOR_MOVE);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await itemRepository.getNumberOfLevelsToFarthestChild(item);
      await itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // post hook
    // question: invoque on all items?
    await this.hooks.runPreHooks('move', actor, repositories, {
      source: item,
      destinationParent: parentItem,
    });

    const result = await this._move(actor, repositories, item, parentItem);

    await this.hooks.runPostHooks('move', actor, repositories, {
      source: item,
      sourceParentId: getParentFromPath(item.path),
      destination: result,
    });

    return { item, moved: result };
  }

  // TODO: optimize
  async moveMany(actor: Actor, repositories: Repositories, itemIds: string[], toItemId?: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const results = await Promise.all(
      itemIds.map((id) => this.move(actor, repositories, id, toItemId)),
    );
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
      await itemMembershipRepository.createMany(inserts);
    }
    if (deletes.length) {
      await itemMembershipRepository.deleteMany(deletes);
    }

    return result;
  }

  /////// -------- COPY
  async copy(actor: Actor, repositories: Repositories, itemId: UUID, args: { parentId?: UUID }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository, itemMembershipRepository, itemGeolocationRepository } = repositories;

    const item = await this.get(actor, repositories, itemId);

    // check how "big the tree is" below the item
    await itemRepository.checkNumberOfDescendants(item, MAX_DESCENDANTS_FOR_COPY);

    // TODO: check memberships
    let parentItem;
    if (args.parentId) {
      parentItem = await itemRepository.get(args.parentId);
      await validatePermission(repositories, PermissionLevel.Write, actor, parentItem);

      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await itemRepository.getNumberOfLevelsToFarthestChild(item);
      await itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await itemRepository.getDescendants(item, { ordered: false });
      items = [...descendants, item];
    }

    // pre hook
    for (const original of items) {
      await this.hooks.runPreHooks('copy', actor, repositories, { original });
    }

    // TODO: args?
    const { copyRoot, treeCopyMap } = await itemRepository.copy(item, actor, parentItem);

    // create a membership if needed
    await itemMembershipRepository
      .post({
        item: copyRoot,
        member: actor,
        creator: actor,
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
      await this.hooks.runPostHooks('copy', actor, repositories, { original, copy });
      // copy geolocation
      await itemGeolocationRepository.copy(original, copy);
      // copy thumbnails if original has setting to true
      if (original.settings.hasThumbnail) {
        try {
          // try to copy thumbnails, this might fail, so we wrap in a try-catch
          await this.thumbnailService.copyFolder(actor, {
            originalId: original.id,
            newId: copy.id,
          });
        } catch {
          this.log.error(`On item copy, thumbnail for ${original.id} could not be found.`);
        }
      }
    }

    return { item, copy: copyRoot };
  }

  // TODO: optimize
  async copyMany(
    actor: Actor,
    repositories: Repositories,
    itemIds: string[],
    args: { parentId?: UUID },
  ) {
    const results = await Promise.all(
      itemIds.map((id) => this.copy(actor, repositories, id, args)),
    );
    return { items: results.map(({ item }) => item), copies: results.map(({ copy }) => copy) };
  }
}

export default ItemService;
