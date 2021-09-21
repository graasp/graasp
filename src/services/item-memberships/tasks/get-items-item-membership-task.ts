// global
import { ItemNotFound, UserCannotReadItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { TaskStatus } from '../../../interfaces/task';

// TODO: does this make sense here? Should this be part of different (micro)service??
export class GetItemsItemMembershipsTask extends BaseItemMembershipTask<ItemMembership[]> {
  get name(): string { return GetItemsItemMembershipsTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    // get item for which we're fetching its memberships
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) throw new ItemNotFound(this.itemId);

    // get memberships
    const itemMemberships = await this.itemMembershipService.getInheritedForAll(item, handler);

    // verify if member has rights to view the item by checking if member is in the list
    const hasRights = itemMemberships.some(m => m.memberId === this.actor.id);
    if (!hasRights) throw new UserCannotReadItem(this.itemId);

    // return item's memberships
    this._result = itemMemberships;
    this.status = TaskStatus.OK;
  }
}
