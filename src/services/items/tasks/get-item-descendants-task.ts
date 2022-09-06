import { FastifyLoggerInstance } from 'fastify';

import {
  DatabaseTransactionHandler,
  Item,
  ItemService,
  MAX_TREE_LEVELS,
  Member,
  TaskStatus,
} from '@graasp/sdk';

import { HierarchyTooDeep, TooManyDescendants } from '../../../util/graasp-error';
import { BaseItem } from '../base-item';
import { BaseItemTask } from './base-item-task';

export type GetItemDescendantsTaskInputType = {
  item?: Item;
  parentItem?: Item;
  maxDescendantsNb?: number;
};

export class GetItemDescendantsTask extends BaseItemTask<Item[]> {
  get name(): string {
    return GetItemDescendantsTask.name;
  }

  input: GetItemDescendantsTaskInputType;
  getInput: () => GetItemDescendantsTaskInputType;

  constructor(member: Member, itemService: ItemService, input?: GetItemDescendantsTaskInputType) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item, parentItem, maxDescendantsNb } = this.input;
    this.targetId = item.id;

    // temporary solution for a prehook for copy in get desendants
    // we moved the following checks from copy-item-task
    // because we needed a posthook on descendants (recycle-bin)
    // check how "big the tree is" below the item
    if (maxDescendantsNb) {
      const numberOfDescendants = await this.itemService.getNumberOfDescendants(item, handler);
      if (numberOfDescendants > maxDescendantsNb) {
        throw new TooManyDescendants(item.id);
      }
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

    // get descendants to max level
    const descendants = await this.itemService.getDescendants(item, handler);

    await this.postHookHandler?.(descendants, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = descendants;
  }
}
