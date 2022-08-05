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

type InputType = { itemPath?: string };

export class GetItemWithPathTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string {
    return GetItemWithPathTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemService: ItemService, input?: InputType) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { itemPath } = this.input;

    // get item
    const item = await this.itemService.getMatchingPath<E>(itemPath, handler);
    if (!item) throw new ItemNotFound(itemPath);

    this.status = TaskStatus.OK;
    this._result = item;
  }
}
