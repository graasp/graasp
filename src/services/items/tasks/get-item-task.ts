// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemNotFound } from '../../../util/graasp-error';
import { UnknownExtra } from '../../../interfaces/extra';
// other services
import { Member } from '../../members/interfaces/member';
// local
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
import { ItemService } from '../db-service';
import { FastifyLoggerInstance } from 'fastify';

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
    this.status = 'RUNNING';

    const { itemId } = this.input;
    this.targetId = itemId;

    // get item
    const item = await this.itemService.get<E>(itemId, handler);
    if (!item) throw new ItemNotFound(itemId);

    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = 'OK';
    this._result = item;
  }
}
