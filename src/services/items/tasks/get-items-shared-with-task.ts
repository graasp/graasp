// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { Item } from '../interfaces/item';
import { BaseItemTask } from './base-item-task';

export class GetItemsSharedWithTask extends BaseItemTask<Item[]> {
  get name(): string {
    return GetItemsSharedWithTask.name;
  }

  constructor(member: Member, itemService: ItemService) {
    super(member, itemService);
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const { id: memberId } = this.actor;

    // get items "shared with" member
    const items = await this.itemService.getSharedWith(memberId, handler);

    this.status = 'OK';
    this._result = items;
  }
}
