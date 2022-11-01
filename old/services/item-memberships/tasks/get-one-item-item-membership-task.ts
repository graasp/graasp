import {
  DatabaseTransactionHandler,
  Item,
  ItemMembership,
  ItemMembershipService,
  Member,
  TaskStatus,
} from '@graasp/sdk';

import { MemberCannotReadItem } from '../../../util/graasp-error';
import { BaseItemMembershipTask } from './base-item-membership-task';

type InputType = { item?: Item };

// TODO: does this make sense here? Should this be part of different (micro)service??
export class GetOneItemItemMembershipsTask extends BaseItemMembershipTask<ItemMembership[]> {
  get name(): string {
    return GetOneItemItemMembershipsTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item } = this.input;
    this.targetId = item.id;

    // get memberships
    const itemMemberships = await this.itemMembershipService.getInheritedForAll(item, handler);

    // verify if member has rights to view the item by checking if member is in the list
    const hasRights = itemMemberships.some((m) => m.memberId === this.actor.id);
    if (!hasRights) throw new MemberCannotReadItem(item.id);

    // return item's memberships
    this._result = itemMemberships;
    this.status = TaskStatus.OK;
  }
}
