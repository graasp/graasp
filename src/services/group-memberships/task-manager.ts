import {GroupMembershipTaskManager} from './interfaces/group-membership-task-manager';
import {MemberService} from '../members/db-service';
import {GroupMembershipService} from './db-service';
import {CreateGroupMembershipTask} from './tasks/create-group-membership-task';
import {Member} from '../members/interfaces/member';
import {GroupMembership} from './interfaces/group-membership';
import {GetGroupMembershipsTask} from './tasks/get-group-memberships-task';
import {ItemMembershipService} from '../item-memberships/db-service';
import {ItemService} from '../items/db-service';

export class TaskManager implements GroupMembershipTaskManager {
  private itemService: ItemService;
  private memberService: MemberService;
  private groupMembershipService: GroupMembershipService;
  private itemMembershipService: ItemMembershipService;
  constructor(
     itemService: ItemService,
     memberService: MemberService,
     groupMembershipService: GroupMembershipService,
     itemMembershipService: ItemMembershipService
  ) {
    this.itemService = itemService;
    this.memberService = memberService;
    this.groupMembershipService = groupMembershipService;
    this.itemMembershipService = itemMembershipService;
  }

  getCreateTaskName(): string { return CreateGroupMembershipTask.name; }

  createCreateTask(member: Member, data: Partial<GroupMembership>, groupId: string): CreateGroupMembershipTask{
    return new CreateGroupMembershipTask(member, data, groupId, this.itemService, this.memberService, this.groupMembershipService, this.itemMembershipService);
  }

  createGetTask(member: Member) : GetGroupMembershipsTask{
    return new GetGroupMembershipsTask(member,this.itemService, this.memberService, this.groupMembershipService, this.itemMembershipService);
  }
}
