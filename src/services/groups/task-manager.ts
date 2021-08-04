import {GroupTaskManager} from './interfaces/group-task-manager';
import {ItemService} from '../items/db-service';
import {ItemMembershipService} from '../item-memberships/db-service';
import {MemberService} from '../members/db-service';
import {GroupMembershipService} from '../group-memberships/db-service';
import {CreateGroupTask} from './tasks/create-group-task';
import {Group, Member} from '../members/interfaces/member';
import {GetGroupTask} from './tasks/get-group-task';
import {GroupService} from './db-service';
import {GetGroupChildrenTask} from './tasks/get-group-children-task';
import {GetRootGroupsTask} from './tasks/get-root-groups-task';

export class TaskManager implements GroupTaskManager {
  private itemService: ItemService;
  private groupService: GroupService;
  private itemMembershipService: ItemMembershipService;
  private memberService: MemberService;
  private groupMembershipService: GroupMembershipService;

  constructor(
    memberService: MemberService,
    itemService: ItemService,
    groupService: GroupService,
    itemMembershipService: ItemMembershipService,
    groupMembershipService: GroupMembershipService,
  ) {
    this.itemService = itemService;
    this.memberService = memberService;
    this.groupService = groupService;
    this.itemMembershipService = itemMembershipService;
    this.groupMembershipService = groupMembershipService;
  }

  getCreateTaskName(): string { return CreateGroupTask.name; }

  createCreateTask(member: Member,data: Partial<Group>,parentId?: string): CreateGroupTask{
    return new CreateGroupTask(member,data,this.memberService,this.itemService,this.groupService,this.itemMembershipService,this.groupMembershipService, parentId);
  }

  createGetTask(member: Member, groupId: string): GetGroupTask {
    return new GetGroupTask(member,groupId,this.memberService,this.itemService,this.groupService,this.itemMembershipService,this.groupMembershipService);
  }

  createGetChildrenTask(member: Member, groupId: string): GetGroupChildrenTask {
    return new GetGroupChildrenTask(member,groupId,this.memberService,this.itemService,this.groupService,this.itemMembershipService,this.groupMembershipService);
  }

  createGetRootGroupsTask(member: Member): GetRootGroupsTask {
    return new GetRootGroupsTask(member,this.memberService,this.itemService,this.groupService,this.itemMembershipService,this.groupMembershipService);
  }
}
