// global
import { FastifyLoggerInstance } from 'fastify';
import { HierarchyTooDeep, TooManyDescendants } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_DESCENDANTS_FOR_COPY, MAX_TREE_LEVELS } from '../../../util/config';
// other services
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { BaseItem } from '../base-item';
import { Item } from '../interfaces/item';
import { TaskStatus } from '../../..';

type CopyItemSubTaskInput = { copy: Partial<Item>; original: Item; shouldCopyTags?: boolean };

class CopyItemSubTask extends BaseItemTask<Item> {
  get name(): string {
    // return main task's name so it is injected with the same hook handlers
    return CopyItemTask.name;
  }

  input: CopyItemSubTaskInput;

  constructor(member: Member, itemService: ItemService, input: CopyItemSubTaskInput) {
    super(member, itemService);
    this.input = input;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = TaskStatus.RUNNING;

    const { copy, original, shouldCopyTags } = this.input;
    this.targetId = original.id;

    await this.preHookHandler?.(copy, this.actor, { log, handler }, { original, shouldCopyTags });
    const item = await this.itemService.create(copy, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler }, { original, shouldCopyTags });

    this.status = TaskStatus.OK;
    this._result = item;
  }
}

type CopyItemTaskInput = { item?: Item; parentItem?: Item; shouldCopyTags?: boolean };

export class CopyItemTask extends BaseItemTask<Item> {
  get name(): string {
    return CopyItemTask.name;
  }
  private subtasks: CopyItemSubTask[];

  input: CopyItemTaskInput;
  getInput: () => CopyItemTaskInput;

  constructor(member: Member, itemService: ItemService, input?: CopyItemTaskInput) {
    const partialSubtasks = true;
    super(member, itemService, partialSubtasks); // partial execution of subtasks
    this.input = input ?? {};
    this.subtasks = [];
  }

  get result(): Item {
    return this.subtasks[0]?.result;
  }

  async run(handler: DatabaseTransactionHandler): Promise<CopyItemSubTask[]> {
    this.status = TaskStatus.RUNNING;
    const { item, parentItem, shouldCopyTags } = this.input;
    this.targetId = item.id;

    // check how "big the tree is" below the item
    const numberOfDescendants = await this.itemService.getNumberOfDescendants(item, handler);
    if (numberOfDescendants > MAX_DESCENDANTS_FOR_COPY) {
      throw new TooManyDescendants(item.id);
    }

    if (parentItem) {
      // attaching copy to some item
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemService.getNumberOfLevelsToFarthestChild(
        item,
        handler,
      );

      if (BaseItem.itemDepth(parentItem) + 1 + levelsToFarthestChild > MAX_TREE_LEVELS) {
        throw new HierarchyTooDeep();
      }
    }

    // copy (memberships from origin are not copied/kept)
    // get the whole tree
    const descendants = await this.itemService.getDescendants(item, handler, 'ASC');
    const treeItems = [item].concat(descendants);
    const treeItemsCopy = this.copy(treeItems, parentItem);

    // return list of subtasks for task manager to copy item + all descendants, one by one.
    treeItemsCopy.forEach(({ copy, original }) => {
      this.subtasks.push(
        new CopyItemSubTask(this.actor, this.itemService, { copy, original, shouldCopyTags }),
      );
    });

    this.status = TaskStatus.DELEGATED;
    return this.subtasks;
  }

  /**
   * Copy whole tree with new paths and same member as creator
   * @param tree Item and all descendants to copy
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  private copy(tree: Item[], parentItem?: Item) {
    const old2New = new Map<string, { copy: Item; original: Item }>();

    for (let i = 0; i < tree.length; i++) {
      const original = tree[i];
      const { name, description, type, path, extra } = original;
      const pathSplit = path.split('.');
      const oldId_ = BaseItem.pathToId(pathSplit.pop());
      let copy: Item;

      if (i === 0) {
        copy = new BaseItem(name, description, type, extra, this.actor.id, parentItem);
      } else {
        const oldParentId_ = BaseItem.pathToId(pathSplit.pop());
        copy = new BaseItem(
          name,
          description,
          type,
          extra,
          this.actor.id,
          old2New.get(oldParentId_).copy,
        );
      }

      old2New.set(oldId_, { copy, original });
    }

    return old2New;
  }
}
