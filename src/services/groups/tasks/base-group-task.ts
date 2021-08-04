import {GroupMembershipService} from '../../group-memberships/db-service';
import {MemberService} from '../../members/db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {Member} from '../../members/interfaces/member';
import {BaseTask} from '../../base-task';
import {GroupService} from '../db-service';

export abstract class BaseGroupTask<R> extends BaseTask<Member, R> {
  protected memberService: MemberService;
  protected itemService: ItemService;
  protected groupService: GroupService;
  protected itemMembershipService: ItemMembershipService;
  protected groupMembershipService: GroupMembershipService;

  parentId?: string;

  constructor(member: Member,
              memberService: MemberService,
              itemService: ItemService,
              groupService: GroupService,
              itemMembershipService: ItemMembershipService,
              groupMembershipService: GroupMembershipService,) {
    super(member);
    this.itemService = itemService;
    this.memberService = memberService;
    this.groupService = groupService;
    this.itemMembershipService = itemMembershipService;
    this.groupMembershipService = groupMembershipService;
  }
}
