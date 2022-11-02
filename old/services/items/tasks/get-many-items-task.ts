import { FastifyLoggerInstance } from 'fastify';

import {
  DatabaseTransactionHandler,
  Item,
  ItemService,
  Member,
  TaskStatus,
  UnknownExtra,
} from '@graasp/sdk';

import { ItemNotFound } from '../../../util/graasp-error';
import { BaseItemTask } from './base-item-task';

type InputType = { itemIds?: string[] };

export class GetManyItemsTask<E extends UnknownExtra> extends BaseItemTask<
  (Item<E> | ItemNotFound)[]
> {
  get name(): string {
    return GetManyItemsTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemService: ItemService, input?: InputType) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { itemIds } = this.input;
    this.targetId = JSON.stringify(itemIds);

    // get item
    const items = await Promise.all(
      itemIds.map(async (id) => {
        const item = await this.itemService.get<E>(id, handler);
        if (!item) {
          return new ItemNotFound(id);
        }
        return item;
      }),
    );

    await this.postHookHandler?.(items, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = items;
  }
}
