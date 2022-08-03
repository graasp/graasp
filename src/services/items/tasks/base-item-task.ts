import { BaseTask, ItemService, Member } from '@graasp/sdk';

import '../db-service';

export abstract class BaseItemTask<R> extends BaseTask<Member, R> {
  protected itemService: ItemService;

  constructor(member: Member, itemService: ItemService, partialSubtasks?: boolean) {
    super(member);
    this.itemService = itemService;
    this._partialSubtasks = partialSubtasks;
  }
}
