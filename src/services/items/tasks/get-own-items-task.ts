// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';

export class GetOwnItemsTask extends BaseItemTask {
  get name(): string { return GetOwnItemsTask.name; }

  constructor(member: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this._status = 'RUNNING';

    const memberId = this.actor.id;

    // get member's "own" items (created by member and where member is admin)
    const items = await this.itemService.getOwn(memberId, handler);

    this._status = 'OK';
    this._result = items;
  }
}
