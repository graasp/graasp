// global
import { FastifyLoggerInstance } from 'fastify';
import {
  HierarchyTooDeep, ItemNotFound, TooManyDescendants,
  UserCannotReadItem, UserCannotWriteItem
} from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_DESCENDANTS_FOR_COPY, MAX_TREE_LEVELS } from '../../../util/config';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { PermissionLevel as pl } from '../../../services/item-memberships/interfaces/item-membership';
import { BaseItemMembership } from '../../../services/item-memberships/base-item-membership';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { BaseItem } from '../base-item';
import { Item } from '../interfaces/item';

class CopyItemSubTask extends BaseItemTask {
  get name() { return CopyItemSubTask.name; }
  private createMembership: boolean;

  constructor(member: Member, itemId: string, data: Partial<Item>,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    createMembership?: boolean) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
    this.data = data;
    this.createMembership = createMembership;
  }

  async run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance) {
    this.status = 'RUNNING';

    await this.preHookHandler?.(this.data, this.actor, log);
    const item = await this.itemService.create(this.data, handler);

    if (this.createMembership) {
      const membership = new BaseItemMembership(this.actor.id, item.path, pl.Admin, this.actor.id);
      await this.itemMembershipService.create(membership, handler);
    }

    this.status = 'OK';
    this._result = item;
  }
}

export class CopyItemTask extends BaseItemTask {
  get name(): string { return CopyItemTask.name; }
  private subtasks: CopyItemSubTask[];

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    parentItemId?: string) {
    const partialSubtasks = true;
    super(member, itemService, itemMembershipService, partialSubtasks); // partial execution of subtasks
    this.targetId = itemId;
    this.parentItemId = parentItemId;
    this.subtasks = [];
  }

  get result(): Item | Item[] { return this.subtasks[0]?.result; }

  async run(handler: DatabaseTransactionHandler): Promise<CopyItemSubTask[]> {
    this.status = 'RUNNING';

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // verify membership rights over item
    const itemPermissionLevel = await this.itemMembershipService.getPermissionLevel(this.actor, item, handler);
    if (!itemPermissionLevel) throw new UserCannotReadItem(this.targetId);

    // check how "big the tree is" below the item
    const numberOfDescendants = await this.itemService.getNumberOfDescendants(item, handler);
    if (numberOfDescendants > MAX_DESCENDANTS_FOR_COPY) {
      throw new TooManyDescendants(this.targetId);
    }

    let parentItem;
    let parentItemPermissionLevel;

    if (this.parentItemId) { // attaching copy to some item
      // get parent item
      parentItem = await this.itemService.get(this.parentItemId, handler);
      if (!parentItem) throw new ItemNotFound(this.parentItemId);

      // verify membership rights over parent item
      parentItemPermissionLevel = await this.itemMembershipService.getPermissionLevel(this.actor, parentItem, handler);
      if (!parentItemPermissionLevel || parentItemPermissionLevel === pl.Read) {
        throw new UserCannotWriteItem(this.parentItemId);
      }

      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild =
        await this.itemService.getNumberOfLevelsToFarthestChild(item, handler);

      if (BaseItem.itemDepth(parentItem) + 1 + levelsToFarthestChild > MAX_TREE_LEVELS) {
        throw new HierarchyTooDeep();
      }
    }

    // copy (memberships from origin are not copied/kept)
    // get the whole tree
    const descendants = await this.itemService.getDescendants(item, handler, 'ASC') as Item[];
    const treeItems = [item].concat(descendants);
    const treeItemsCopy = this.copy(treeItems, parentItem);

    // return list of subtasks for task manager to copy item + all descendants, one by one.
    const createAdminMembership = !parentItem || parentItemPermissionLevel === pl.Write;

    treeItemsCopy.forEach((itemCopy, oldId) => {
      // create 'admin' membership for "top" parent item if necessary
      const createMembership = oldId === this.targetId ? createAdminMembership : false;
      const subtask = new CopyItemSubTask(this.actor, oldId, itemCopy,
        this.itemService, this.itemMembershipService, createMembership);
      subtask.preHookHandler = this.preHookHandler;

      this.subtasks.push(subtask);
    });

    this.status = 'DELEGATED';
    return this.subtasks;
  }

  /**
   * Copy whole tree with new paths and same member as creator
   * @param tree Item and all descendants to copy
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  private copy(tree: Item[], parentItem?: Item) {
    const old2New = new Map<string, Item>();

    for (let i = 0; i < tree.length; i++) {
      const { name, description, type, path, extra } = tree[i];
      const pathSplit = path.split('.');
      const oldId_ = BaseItem.pathToId(pathSplit.pop());
      let item;

      if (i === 0) {
        item = new BaseItem(name, description, type, extra, this.actor.id, parentItem);
      } else {
        const oldParentId_ = BaseItem.pathToId(pathSplit.pop());
        item = new BaseItem(name, description, type, extra, this.actor.id, old2New.get(oldParentId_));
      }

      old2New.set(oldId_, item);
    }

    return old2New;
  }
}
