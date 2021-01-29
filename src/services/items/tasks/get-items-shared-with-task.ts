// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';

export class GetItemsSharedWithTask extends BaseItemTask {
  get name(): string { return GetItemsSharedWithTask.name; }

  constructor(member: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this._status = 'RUNNING';

    const memberId = this.actor.id;

    // get items "shared with" member
    const items = await this.itemService.getSharedWith(memberId, handler);

    this._status = 'OK';
    this._result = items;
  }
}
