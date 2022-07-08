import { FastifyLoggerInstance } from 'fastify';

import { DatabaseTransactionHandler, Item, ItemService, Member, TaskStatus } from '@graasp/sdk';

import { BaseItemTask } from './base-item-task';

export interface GetItemsSharedWithTaskInputType {
  permissions?: string[];
}
export class GetItemsSharedWithTask extends BaseItemTask<Item[]> {
  input: GetItemsSharedWithTaskInputType;

  get name(): string {
    return GetItemsSharedWithTask.name;
  }

  constructor(member: Member, itemService: ItemService, input: GetItemsSharedWithTaskInputType) {
    super(member, itemService);
    this.input = input;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { id: memberId } = this.actor;

    // get items "shared with" member
    const items = await this.itemService.getSharedWith(memberId, this.input, handler);

    await this.postHookHandler?.(items, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = items;
  }
}
