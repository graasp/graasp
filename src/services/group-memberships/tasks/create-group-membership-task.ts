import {GroupMembership} from '../interfaces/group-membership';
import {Member, MemberType} from '../../members/interfaces/member';
import {BaseGroupMembershipTask} from './base-group-membership-task';
import {MemberService} from '../../members/db-service';
import {GroupMembershipService} from '../db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {DatabaseTransactionHandler} from '../../../plugins/database';
import {
  CannotAdminGroup,
  GroupMembershipExists,
  GroupNotFound,
  MemberIsNotAGroup,
  MemberNotFound,
  RootFolderNotFound
} from '../../../util/graasp-error';
import {GroupExtra} from '../../../interfaces/group-extra';
import {BaseGroupMembership} from '../base-group-membership';

export class CreateGroupMembershipTask extends BaseGroupMembershipTask< GroupMembership > {
  get name(): string {
    return CreateGroupMembershipTask.name;
  }

  constructor(
    member: Member,
    data: Partial<GroupMembership>,
    groupId: string,
    itemService: ItemService,
    memberService: MemberService,
    groupMembershipService: GroupMembershipService,
    itemMembershipService: ItemMembershipService
  ) {
    super(member, itemService, memberService, itemMembershipService, groupMembershipService);
    this.data = data;
    this.targetId = groupId;
  }
  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const member = await this.memberService.get(this.data.member,handler);

    if (!member) throw new MemberNotFound(this.data.member);

    const group = await this.memberService.get<GroupExtra>(this.targetId,handler);
    if (!group) throw new GroupNotFound(this.targetId);

    if(group.type!==MemberType.Group) throw new MemberIsNotAGroup(this.targetId);

    const {extra : { rootFolder: { itemId: rootFolderId }}} = group;

    const rootFolder = await this.itemService.get(rootFolderId,handler);
    if(!rootFolder) throw new RootFolderNotFound(rootFolder);

    const canAdminFolder = await this.itemMembershipService.canAdmin(this.actor.id,rootFolder,handler);
    if(!canAdminFolder) throw new CannotAdminGroup(group.id);

    const membership = await this.groupMembershipService.checkMembership(this.data.member,this.targetId,handler);
    if(membership) throw new GroupMembershipExists({member: this.data.member, group: this.targetId});


    const baseGroupMembership = new BaseGroupMembership(member.id,group.id);

    this._result = await this.groupMembershipService.create(baseGroupMembership, handler);
    this.status = 'OK';
  }
}
