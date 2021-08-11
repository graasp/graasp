// global
import { ItemNotFound, UserCannotReadItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { GroupMembershipService } from '../../group-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';

// TODO: does this make sense here? Should this be part of different (micro)service??
export class GetItemsItemMembershipsTask extends BaseItemMembershipTask<ItemMembership[]> {
  get name(): string { return GetItemsItemMembershipsTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService, groupMembershipService: GroupMembershipService) {
    super(member, itemService, itemMembershipService,groupMembershipService);
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get item for which we're fetching its memberships
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) throw new ItemNotFound(this.itemId);

    // get memberships
    const itemMemberships = await this.itemMembershipService.getInheritedForAll(item, handler);

    // get groupMemberships
    const groupMemberships = await this.groupMembershipService.getGroupMemberships(this.actor.id,handler);

    const groups = groupMemberships.map((gM) => gM.group);
    // verify if member has rights to view the item by checking if member is in the list
    const hasRights = itemMemberships.some(m => (
      m.memberId === this.actor.id) || groups.includes(m.memberId)
    );

    if (!hasRights) throw new UserCannotReadItem(this.itemId);

    // return item's memberships
    this._result = itemMemberships;
    this.status = 'OK';
  }
}
