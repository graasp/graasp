// global
import { BaseTask } from '../../base-task';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';

export abstract class BaseItemTask<R> extends BaseTask<Member, R> {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService;

  /** id of the item to which some tasks will append the item being processed */
  parentItemId?: string;

  constructor(
    member: Member,
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
    partialSubtasks?: boolean,
  ) {
    super(member);
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this._partialSubtasks = partialSubtasks;
  }
}
