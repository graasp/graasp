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

type InputType = { itemId?: string };

export class GetItemTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string {
    return GetItemTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemService: ItemService, input?: InputType) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { itemId } = this.input;
    this.targetId = itemId;

    // get item
    const item = await this.itemService.get<E>(itemId, handler);
    if (!item) throw new ItemNotFound(itemId);

    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = item;
  }
}
