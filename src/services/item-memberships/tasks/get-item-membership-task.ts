import {
  DatabaseTransactionHandler,
  ItemMembership,
  ItemMembershipService,
  Member,
  TaskStatus,
} from '@graasp/sdk';

import { ItemMembershipNotFound } from '../../../util/graasp-error';
import { BaseItemMembershipTask } from './base-item-membership-task';

type InputType = { itemMembershipId?: string };

export class GetItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    return GetItemMembershipTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { itemMembershipId } = this.input;

    // verify membership rights over item
    const itemMembership = await this.itemMembershipService.get(itemMembershipId, handler);
    if (!itemMembership) throw new ItemMembershipNotFound(itemMembershipId);

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}
