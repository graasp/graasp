import { FastifyLoggerInstance } from 'fastify';

import {
  DatabaseTransactionHandler,
  Item,
  ItemService,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TREE_LEVELS,
  Member,
  TaskStatus,
  UnknownExtra,
} from '@graasp/sdk';

import { HierarchyTooDeep, TooManyChildren } from '../../../util/graasp-error';
import { BaseItem } from '../base-item';
import { BaseItemTask } from './base-item-task';

type InputType<E extends UnknownExtra> = { data?: Partial<Item<E>>; parentItem?: Item };

export class CreateItemTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string {
    return CreateItemTask.name;
  }

  input: InputType<E>;
  getInput: () => InputType<E>;

  constructor(member: Member, itemService: ItemService, input?: InputType<E>) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { data, parentItem } = this.input;

    if (parentItem) {
      // check if hierarchy it too deep
      if (BaseItem.itemDepth(parentItem) + 1 > MAX_TREE_LEVELS) {
        throw new HierarchyTooDeep();
      }

      // check if there's too many children under the same parent
      const numberOfChildren = await this.itemService.getNumberOfChildren(parentItem, handler);
      if (numberOfChildren + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }
    }

    // create item
    const { name, description, type, extra, settings } = data;
    const { id: creator } = this.actor;
    let item = new BaseItem(name, description, type, extra, settings, creator, parentItem);

    await this.preHookHandler?.(item, this.actor, { log, handler });
    item = await this.itemService.create(item, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler });
    this.status = TaskStatus.OK;
    this._result = item;
  }
}
