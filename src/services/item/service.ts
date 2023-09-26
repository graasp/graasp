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
} from '@graasp/sdk';

import { ITEMS_LIST_LIMIT } from '../../utils/config';
import {
  CoreError,
  InvalidMembership,
  MemberCannotWriteItem,
  TooManyChildren,
  TooManyDescendants,
  UnauthorizedMember,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { filterOutItems, validatePermission, validatePermissionMany } from '../authorization';
import { Actor, Member } from '../member/entities/member';
import { mapById } from '../utils';
import { Item } from './entities/Item';
import { PaginationArgs } from './interfaces/response';

export class ItemService {
  hooks = new HookManager<{
    create: { pre: { item: Partial<Item> }; post: { item: Item } };
    update: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
    copy: { pre: { original: Item }; post: { original: Item; copy: Item } };
    move: {
      pre: { source: Item; destination: Item };
      post: { source: Item; destination: Item; updated: Item };
    };
  }>();

  async post(
    actor: Actor,
    repositories: Repositories,
    args: { item: Partial<Item>; parentId?: string },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository, itemMembershipRepository } = repositories;

    const { item, parentId } = args;

    await this.hooks.runPreHooks('create', actor, repositories, { item });

    let createdItem = itemRepository.create({ ...item, creator: actor });

    let inheritedMembership;
    let parentItem: Item | undefined = undefined;
    // TODO: HOOK?
    // check permission over parent
    if (parentId) {
      parentItem = await itemRepository.get(parentId);
      await validatePermission(repositories, PermissionLevel.Write, actor, parentItem);
      inheritedMembership = await itemMembershipRepository.getInherited(parentItem, actor, true);

      if (parentItem.type !== ItemType.FOLDER) {
        throw new Error('ITEM NOT FOLDER'); // TODO
      }

      itemRepository.checkHierarchyDepth(parentItem);
      parentItem = parentItem as Item; // TODO: FolderItemType
      // check if there's too many children under the same parent
      const descendants = await itemRepository.getChildren(parentItem);
      if (descendants.length + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }
    }

    createdItem = await itemRepository.post(item, actor, parentItem);

    // create membership if inherited is less than admin
    if (
      !inheritedMembership ||
      PermissionLevelCompare.lt(inheritedMembership?.permission, PermissionLevel.Admin)
    ) {
      await itemMembershipRepository.post({
        item: createdItem,
        member: actor,
        creator: actor,
        permission: PermissionLevel.Admin,
      });
    }

    await this.hooks.runPostHooks('create', actor, repositories, { item: createdItem });

    return createdItem;
  }

  async get(
    actor: Actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const item = await repositories.itemRepository.get(id);

    await validatePermission(repositories, permission, actor, item);

    return item;
  }

  async getMany(actor: Actor, repositories: Repositories, ids: string[]) {
    const { itemRepository } = repositories;
    const result = await itemRepository.getMany(ids);

    // check memberships
    // remove items if they do not have permissions
    const memberships = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      Object.values(result.data),
    );

    for (const [id, item] of Object.entries(result.data)) {
      // Do not delete if value exist but is null, because no memberships but can be public
      if (memberships?.data[id] === undefined) {
        delete result.data[id];
      }
    }

    return { data: result.data, errors: result.errors.concat(memberships?.errors ?? []) };
  }

  async getOwn(
    actor: Actor,
    { itemRepository }: Repositories,
    searchArgs: {
      name: string;
    },
    args: PaginationArgs,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    return itemRepository.getOwn(actor.id, searchArgs, args);
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

  async getChildren(actor: Actor, repositories: Repositories, itemId: string, ordered?: boolean) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    // TODO optimize?
    return filterOutItems(actor, repositories, await itemRepository.getChildren(item, ordered));
  }

  async getDescendants(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    // TODO optimize?
    return filterOutItems(actor, repositories, await itemRepository.getDescendants(item));
  }

  async getParents(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    // TODO optimize?
    const parents = await itemRepository.getAncestors(item);

    let lastIdx = parents.length;
    // filter out if does not have membership
    for (let i = 0; i < parents.length; i++) {
      try {
        await validatePermission(
          repositories,
          PermissionLevel.Read,
          actor,
          parents[parents.length - i],
        );
        lastIdx = i;
      } catch (e) {
        return parents.slice(parents.length - lastIdx, parents.length);
      }
    }
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
    const descendants = await itemRepository.getDescendants(item);
    if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
      throw new TooManyDescendants(itemId);
    }

    const items = [...descendants, item];

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

    // todo: optimize
    const allDescendants = await Promise.all(
      allItems.map(async (item) => {
        await validatePermission(repositories, PermissionLevel.Admin, actor, item);
        // check how "big the tree is" below the item
        // we do not use checkNumberOfDescendants because we use descendants
        const descendants = await itemRepository.getDescendants(item);
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
      destination: parentItem,
    });

    await this._move(actor, repositories, item, parentItem);

    const afterMove = await itemRepository.get(itemId);

    await this.hooks.runPostHooks('move', actor, repositories, {
      source: item,
      destination: parentItem,
      updated: afterMove,
    });

    // TODO: optimize
    return afterMove;
  }

  // TODO: optimize
  async moveMany(actor: Actor, repositories: Repositories, itemIds: string[], toItemId?: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const items = await Promise.all(
      itemIds.map((id) => this.move(actor, repositories, id, toItemId)),
    );
    return items;
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

    await itemRepository.move(item, parentItem);

    // adjust memberships to keep the constraints
    if (inserts.length) {
      await itemMembershipRepository.createMany(inserts);
    }
    if (deletes.length) {
      await itemMembershipRepository.deleteMany(deletes);
    }
  }

  /////// -------- COPY
  async copy(actor: Actor, repositories: Repositories, itemId: UUID, args: { parentId?: UUID }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const { itemRepository, itemMembershipRepository } = repositories;

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

    const descendants = await itemRepository.getDescendants(item);
    const items = [...descendants, item];

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
    }

    return copyRoot;
  }

  // TODO: optimize
  async copyMany(
    actor: Actor,
    repositories: Repositories,
    itemIds: string[],
    args: { parentId?: UUID },
  ) {
    const items = await Promise.all(
      itemIds.map(async (id) => this.copy(actor, repositories, id, args)),
    );
    return items;
  }
}

export default ItemService;
