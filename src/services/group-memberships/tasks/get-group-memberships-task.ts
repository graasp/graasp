import {BaseGroupMembershipTask} from './base-group-membership-task';
import {GroupMembership} from '../interfaces/group-membership';
import {Member} from '../../members/interfaces/member';
import {MemberService} from '../../members/db-service';
import {ItemService} from '../../items/db-service';
import {GroupMembershipService} from '../db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {DatabaseTransactionHandler} from '../../../plugins/database';

export class GetGroupMembershipsTask extends BaseGroupMembershipTask<GroupMembership[]> {
  get name(): string {
    return GetGroupMembershipsTask.name;
  }

  constructor(
    member: Member,
    itemService: ItemService,
    memberService: MemberService,
    groupMembershipService: GroupMembershipService,
    itemMembershipService: ItemMembershipService
  ) {
    super(member, itemService, memberService, itemMembershipService, groupMembershipService);
  }
  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const memberId = this.actor.id;

    this._result = await this.groupMembershipService.getGroupMemberships(memberId, handler);
    this.status = 'OK';
  }
}
