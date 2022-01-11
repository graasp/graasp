// global
import { MemberCannotReadItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../../services/members/interfaces/member';
import { Item } from '../../items/interfaces/item';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { TaskStatus } from '../../..';

type InputType = { items?: Item[]; shouldValidatePermission?: boolean };

// TODO: does this make sense here? Should this be part of different (micro)service??
export class GetManyItemsItemMembershipsTask extends BaseItemMembershipTask<unknown[]> {
  get name(): string {
    return GetManyItemsItemMembershipsTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { items, shouldValidatePermission = true } = this.input;
    this.targetId = items.map(({ id }) => id).join(',');

    // get memberships
    const itemMemberships = await Promise.all(
      items.map(async (item) => {
        // the item might be malformed / be an error, return it
        if (!item.id) {
          return item;
        }
        const memberships = await this.itemMembershipService.getInheritedForAll(item, handler);
        // verify if member has rights to view the item by checking if member is in the list
        if (shouldValidatePermission) {
          const hasRights = memberships.some((m) => m.memberId === this.actor.id);
          if (!hasRights) return new MemberCannotReadItem(item.id);
        }
        return memberships;
      }),
    );

    // return item's memberships
    this._result = itemMemberships;
    this.status = TaskStatus.OK;
  }
}
