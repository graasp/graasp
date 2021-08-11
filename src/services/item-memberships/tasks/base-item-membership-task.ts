// global
import { BaseTask } from '../../base-task';
// other services
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../../items/db-service';
import { GroupMembershipService } from '../../group-memberships/db-service';

// local
import { ItemMembershipService } from '../db-service';

export abstract class BaseItemMembershipTask<R> extends BaseTask<Member, R> {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected groupMembershipService?: GroupMembershipService

  /** id of the item to which the ItemMembership is linked to */
  itemId?: string;

  constructor(member: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService, groupMembershipService?: GroupMembershipService) {
    super(member);
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.groupMembershipService = groupMembershipService;
  }
}
