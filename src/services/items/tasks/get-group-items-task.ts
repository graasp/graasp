// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemMembershipService } from '../../item-memberships/db-service';
import { Member } from '../../members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { Item } from '../interfaces/item';
import { BaseItemTask } from './base-item-task';
import {ItemNotFound} from '../../../util/graasp-error';

export class GetGroupItemsTask extends BaseItemTask<Item[]> {
  get name(): string { return GetGroupItemsTask.name; }

  constructor(member: Member, itemId: string,
              itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const item = await this.itemService
      .get(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // get item's children
    const children = await this.itemService.getDescendants(item, handler, 'ASC', 1);

    this.status = 'OK';
    this._result = children;
  }
}
