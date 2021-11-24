// global
import { TooManyMemberships } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../../services/members/interfaces/member';
import { Item } from '../../items/interfaces/item';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import {
  DeleteItemMembershipSubTask,
  DeleteItemMembershipTask,
} from './delete-item-membership-task';
import { MAX_ITEM_MEMBERSHIPS_FOR_DELETE } from '../../../util/config';

type InputType = { item?: Item };

export class DeleteItemItemMembershipsTask extends BaseItemMembershipTask<ItemMembership> {
  // return main task's name so it is injected with the same hook handlers
  get name(): string {
    return DeleteItemMembershipTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this.status = 'RUNNING';

    const { item } = this.input;
    this.targetId = item.id;

    // get all item membership at, and below, the given item
    const itemMemberships = await this.itemMembershipService.getAllInSubtree(item, handler);
    if (itemMemberships.length > MAX_ITEM_MEMBERSHIPS_FOR_DELETE) throw new TooManyMemberships();

    this.status = 'DELEGATED';

    // return list of subtasks for task manager to execute and
    // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
    return itemMemberships
      .filter((im) => im.memberId != this.actor.id) // exclude (possible) member's own membership
      .map(
        ({ id: itemMembershipId }) =>
          new DeleteItemMembershipSubTask(this.actor, this.itemMembershipService, {
            itemMembershipId,
          }),
      );
  }
}
