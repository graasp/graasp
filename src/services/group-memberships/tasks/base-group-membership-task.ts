import {BaseTask} from '../../base-task';
import {Member} from '../../members/interfaces/member';
import {MemberService} from '../../members/db-service';
import {GroupMembershipService} from '../db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';

export abstract class BaseGroupMembershipTask<R> extends BaseTask<Member, R> {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected memberService: MemberService
  protected groupMembershipService: GroupMembershipService

  constructor(member: Member,
              itemService: ItemService,
              memberService: MemberService,
              itemMembershipService: ItemMembershipService,
              groupMembershipService: GroupMembershipService) {
    super(member);
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.memberService = memberService;
    this.groupMembershipService = groupMembershipService;
  }
}
