import { FastifyLoggerInstance } from 'fastify';

import {
  DatabaseTransactionHandler,
  Item,
  ItemService,
  Member,
  TaskStatus,
  UnknownExtra,
} from '@graasp/sdk';

import { BaseItemTask } from './base-item-task';

export class GetOwnItemsTask extends BaseItemTask<Item[]> {
  get name(): string {
    return GetOwnItemsTask.name;
  }

  constructor(member: Member, itemService: ItemService) {
    super(member, itemService);
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { id: memberId } = this.actor;

    // get member's "own" items (created by member and where member is admin)
    const items = await this.itemService.getOwn(memberId, handler);

    await this.postHookHandler?.(items, this.actor, { log, handler });
    this.status = TaskStatus.OK;
    this._result = items;
  }
}
