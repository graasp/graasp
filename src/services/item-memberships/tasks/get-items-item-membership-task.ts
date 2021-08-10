// global
import { MemberCannotReadItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../../services/members/interfaces/member';
import { Item } from '../../items/interfaces/item';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';

type InputType = { item?: Item };

// TODO: does this make sense here? Should this be part of different (micro)service??
export class GetItemsItemMembershipsTask extends BaseItemMembershipTask<ItemMembership[]> {
  get name(): string {
    return GetItemsItemMembershipsTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const { item } = this.input;
    this.targetId = item.id;

    // get memberships
    const itemMemberships = await this.itemMembershipService.getInheritedForAll(item, handler);

    // verify if member has rights to view the item by checking if member is in the list
    const hasRights = itemMemberships.some(m => m.memberId === this.actor.id);
    if (!hasRights) throw new MemberCannotReadItem(item.id);

    // return item's memberships
    this._result = itemMemberships;
    this.status = 'OK';
  }
}
