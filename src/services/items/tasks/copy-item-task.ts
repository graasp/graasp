import { FastifyLoggerInstance } from 'fastify';

import { DatabaseTransactionHandler, Item, ItemService, Member, TaskStatus } from '@graasp/sdk';

import { BaseItem, dashToUnderscore } from '../base-item';
import { ITEM_TYPES } from '../constants/constants';
import { sortChildrenWith } from '../constants/utils';
import { BaseItemTask } from './base-item-task';
import { FolderExtra } from './get-item-children-task';

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

type CopyItemTaskInput = {
  item?: Item;
  parentItem?: Item;
  shouldCopyTags?: boolean;
  descendants?: Item[];
};

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
    const { item, parentItem, shouldCopyTags, descendants } = this.input;
    this.targetId = item.id;

    // copy (memberships from origin are not copied/kept)
    // get the whole tree
    const treeItems = [item].concat(descendants);
    const treeItemsCopy = this.copy(treeItems, parentItem);
    this.fixChildrenOrder(treeItemsCopy);
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
      const { name, description, type, path, extra, settings } = original;
      const pathSplit = path.split('.');
      const oldId_ = BaseItem.pathToId(pathSplit.pop());
      let copy: Item;

      if (i === 0) {
        copy = new BaseItem(name, description, type, extra, settings, this.actor.id, parentItem);
      } else {
        const oldParentId_ = BaseItem.pathToId(pathSplit.pop());
        copy = new BaseItem(
          name,
          description,
          type,
          extra,
          settings,
          this.actor.id,
          old2New.get(oldParentId_).copy,
        );
      }

      old2New.set(oldId_, { copy, original });
    }

    return old2New;
  }

  // replace children order with new ids
  private fixChildrenOrder(itemsMap: Map<string, { copy: Item; original: Item }>) {
    const copyItemsArray = Array.from(itemsMap.values()).map(({ copy }) => copy);
    itemsMap.forEach((value) => {
      const { copy, original } = value;
      // set order for all copied folder
      if (original.type === ITEM_TYPES.FOLDER) {
        // init extra if necessary
        if (!copy.extra.folder) {
          copy.extra.folder = {};
        }

        const childrenOrder = (original.extra as FolderExtra)?.folder?.childrenOrder || [];

        // change previous ids to copied item ids
        const copyOrder = childrenOrder
          .map((oldId) => itemsMap.get(oldId)?.copy?.id)
          .filter(Boolean);

        // get direct children
        const children = copyItemsArray.filter(({ id, path }) => {
          return path === `${copy.path}.${dashToUnderscore(id)}`;
        });

        // sort children to get wanter order -> get order by mapping to id
        children.sort(sortChildrenWith(copyOrder));
        const completeOrder = children.map(({ id }) => id);

        (copy.extra as FolderExtra).folder.childrenOrder = completeOrder;
      }

      return value;
    });
  }
}
