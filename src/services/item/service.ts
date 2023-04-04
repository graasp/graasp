import {
  FolderItemType,
  ItemType,
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_NUMBER_OF_CHILDREN,
  PermissionLevel,
  PermissionLevelCompare,
  UUID,
} from '@graasp/sdk';

import {
  MemberCannotWriteItem,
  TooManyChildren,
  TooManyDescendants,
} from '../../util/graasp-error';
import HookManager from '../../util/hook';
import { Repositories } from '../../util/repositories';
import { filterOutItems, validatePermission } from '../authorization';
import { Member } from '../member/entities/member';
import { mapById } from '../utils';
import { Item } from './entities/Item';

export class ItemService {
  hooks = new HookManager();

  async create(
    actor,
    repositories: Repositories,
    args: { item: Partial<Item>; parentId?: string; creator: Member },
  ) {
    const { itemRepository, itemMembershipRepository } = repositories;

    const { item, parentId } = args;
    let createdItem = itemRepository.create({ ...item, creator: actor });

    let inheritedMembership;
    let parentItem = null;
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
    return createdItem;
  }

  async get(
    actor,
    repositories: Repositories,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const item = await repositories.itemRepository.get(id);

    await validatePermission(repositories, permission, actor, item);

    return item;
  }

  async getMany(actor, repositories: Repositories, ids: string[]) {
    const { itemRepository } = repositories;
    const result = await itemRepository.getMany(ids);

    // TODO: check memberships
    // remove items if they do not have permissions
    for (const [id, item] of Object.entries(result.data)) {
      await validatePermission(repositories, PermissionLevel.Read, actor, item);
    }

    return result;
  }

  async getOwn(actor, { itemRepository }: Repositories) {
    return itemRepository.getOwn(actor.id);
  }

  async getShared(actor, repositories: Repositories, permission?: PermissionLevel) {
    const { itemMembershipRepository } = repositories;
    const items = await itemMembershipRepository.getSharedItems(actor, permission);
    // TODO optimize?
    return filterOutItems(repositories, items);
  }

  async getChildren(actor: Member, repositories: Repositories, itemId: string, ordered?: boolean) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    // TODO optimize?
    return filterOutItems(repositories, await itemRepository.getChildren(item, ordered));
  }

  async getDescendants(actor, repositories: Repositories, itemId: UUID) {
    const { itemRepository } = repositories;
    const item = await this.get(actor, repositories, itemId);

    // TODO optimize?
    return filterOutItems(repositories, await itemRepository.getDescendants(item));
  }

  async getParents(actor, repositories: Repositories, itemId: UUID) {
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

  async patch(actor, repositories: Repositories, itemId: UUID, body) {
    const { itemRepository } = repositories;

    // check memberships
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Write, actor, item);
    return itemRepository.patch(itemId, body);
  }

  async patchMany(actor, repositories: Repositories, itemIds: UUID[], body) {
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
  async delete(actor, repositories: Repositories, itemId: UUID) {
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
    await itemRepository.deleteMany(items);

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(actor, repositories: Repositories, itemIds: string[]) {
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
    await itemRepository.deleteMany(items);

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, repositories, { item });
    }

    return allItems;
  }

  /////// -------- MOVE
  async move(actor, repositories: Repositories, itemId, toItemId?: string) {
    const { itemRepository } = repositories;
    // TODO: check memberships
    let parentItem = null;
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

    await this._move(actor, repositories, item, parentItem);

    // TODO: optimize
    return itemRepository.get(itemId);
  }

  // TODO: optimize
  async moveMany(actor, repositories: Repositories, itemIds: string[], toItemId?: string) {
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
  async _move(actor, repositories: Repositories, item: Item, parentItem?: Item) {
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
  async copy(actor, repositories: Repositories, itemId, args) {
    const { itemRepository } = repositories;

    const item = await this.get(actor, repositories, itemId);

    // check how "big the tree is" below the item
    await itemRepository.checkNumberOfDescendants(item, MAX_DESCENDANTS_FOR_COPY);

    // TODO: check memberships
    let parentItem = null;
    if (args.parentId) {
      parentItem = await itemRepository.get(args.parentId);
      await validatePermission(repositories, PermissionLevel.Write, actor, parentItem);

      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await itemRepository.getNumberOfLevelsToFarthestChild(item);
      await itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // TODO: post hook - for loop on descendants
    await this.hooks.runPreHooks('copy', actor, repositories, { item });

    const result = await itemRepository.copy(item, actor, parentItem, args);

    // TODO: post hook - for loop on descendants
    await this.hooks.runPostHooks('copy', actor, repositories, { original: item, copy: result });

    return result;
  }

  // TODO: optimize
  async copyMany(actor, repositories: Repositories, itemIds: string[], args) {
    const items = await Promise.all(
      itemIds.map(async (id) => this.copy(actor, repositories, id, args)),
    );
    return items;
  }
}

export default ItemService;
