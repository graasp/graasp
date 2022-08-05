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

type InputType<E extends UnknownExtra> = { item?: Item<E>; data?: Partial<Item<E>> };

export class UpdateItemTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string {
    return UpdateItemTask.name;
  }

  input: InputType<E>;
  getInput: () => InputType<E>;

  constructor(member: Member, itemService: ItemService, input?: InputType<E>) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item, data } = this.input;
    const { extra: extraChanges, settings: settingsChanges } = data;
    this.targetId = item.id;

    // only allow for item type specific changes in extra
    if (extraChanges) {
      if (Object.keys(extraChanges).length === 1 && extraChanges[item.type]) {
        data.extra = Object.assign({}, item.extra, extraChanges);
      } else {
        delete data.extra;
      }
    }

    if (settingsChanges) {
      if (Object.keys(settingsChanges).length === 1) {
        data.settings = Object.assign({}, item.settings, settingsChanges);
      } else {
        delete data.settings;
      }
    }

    // update item
    await this.preHookHandler?.(item, this.actor, { log, handler });
    const resultItem = Object.keys(data).length
      ? await this.itemService.update(item.id, data, handler)
      : item;
    await this.postHookHandler?.(resultItem, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = resultItem;
  }
}
