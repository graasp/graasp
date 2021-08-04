import {BaseGroupTask} from './base-group-task';
import {Group, Member} from '../../members/interfaces/member';
import {MemberService} from '../../members/db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {GroupMembershipService} from '../../group-memberships/db-service';
import {DatabaseTransactionHandler} from '../../../plugins/database';
import {GroupService} from '../db-service';

export class GetRootGroupsTask extends BaseGroupTask<Group[]> {
  get name(): string {
    return GetRootGroupsTask.name;
  }

  constructor(
    member: Member,
    memberService: MemberService,
    itemService: ItemService,
    groupService: GroupService,
    itemMembershipService: ItemMembershipService,
    groupMembershipService: GroupMembershipService,
  ) {
    super(
      member, memberService,itemService,groupService,itemMembershipService,groupMembershipService);
  }
  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    this._result = await this.groupService.getRootGroups(this.actor.id,handler);

    this.status = 'OK';
  }
}
