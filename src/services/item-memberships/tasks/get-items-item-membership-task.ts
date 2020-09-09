// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// other services
import { ItemService } from 'services/items/db-service';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';

export class GetItemsItemMembershipsTask extends BaseItemMembershipTask {
  get name() { return GetItemsItemMembershipsTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get item for which we're fetching its memberships
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) this.failWith(new GraaspError(GraaspError.ItemNotFound, this.itemId));

    // get memberships
    const itemMemberships = await this.itemMembershipService.getInheritedForAll(item, handler);

    // verify if member has rights to view the item by checking if member is in the list
    const hasRights = itemMemberships.some(m => m.memberId === this.actor.id);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotReadItem, this.itemId));

    // create membership
    this._result = itemMemberships;
    this._status = TaskStatus.OK;
  }
}
