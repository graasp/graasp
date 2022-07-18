// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
import { FastifyLoggerInstance } from 'fastify';
import { TaskStatus } from '../../..';

export type GetItemDescendantsTaskInputType = { item?: Item };

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

    const { item } = this.input;
    this.targetId = item.id;

    // get descendants to max level
    const descendants = await this.itemService.getDescendants(item, handler);

    await this.postHookHandler?.(descendants, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = descendants;
  }
}
