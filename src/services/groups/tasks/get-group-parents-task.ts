import {BaseGroupTask} from './base-group-task';
import {Group, Member} from '../../members/interfaces/member';
import {MemberService} from '../../members/db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {GroupMembershipService} from '../../group-memberships/db-service';
import {DatabaseTransactionHandler} from '../../../plugins/database';
import {CannotAccessGroup, GroupNotFound} from '../../../util/graasp-error';
import {GroupExtra} from '../../../interfaces/group-extra';
import {GroupService} from '../db-service';

export class GetGroupParentsTask extends BaseGroupTask<Group[]> {
  get name(): string {
    return GetGroupParentsTask.name;
  }

  constructor(
    member: Member,
    groupId: string,
    memberService: MemberService,
    itemService: ItemService,
    groupService: GroupService,
    itemMembershipService: ItemMembershipService,
    groupMembershipService: GroupMembershipService,
  ) {
    super(
      member, memberService,itemService,groupService,itemMembershipService,groupMembershipService);
    this.targetId = groupId;
  }
  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const group = await this.memberService.get<GroupExtra>(this.targetId,handler);
    if(!group) throw new GroupNotFound(this.targetId);

    const hasRight = await this.groupMembershipService.checkMembership(this.actor.id,this.targetId,handler);
    if(!hasRight) throw new CannotAccessGroup(this.targetId);

    this._result = await this.groupService.getGroupParents(group.id, handler);
    this.status = 'OK';
  }
}
