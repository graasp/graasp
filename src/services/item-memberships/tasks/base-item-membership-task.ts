// global
import { BaseTask } from '../../base-task';
// other services
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';

export abstract class BaseItemMembershipTask<R> extends BaseTask<Member, R> {
  protected itemMembershipService: ItemMembershipService;

  constructor(member: Member, itemMembershipService: ItemMembershipService) {
    super(member);
    this.itemMembershipService = itemMembershipService;
  }
}
