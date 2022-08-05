import { BaseTask, ItemMembershipService, Member } from '@graasp/sdk';

export abstract class BaseItemMembershipTask<R> extends BaseTask<Member, R> {
  protected itemMembershipService: ItemMembershipService;

  constructor(member: Member, itemMembershipService: ItemMembershipService) {
    super(member);
    this.itemMembershipService = itemMembershipService;
  }
}
