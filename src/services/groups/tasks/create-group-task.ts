import {BaseGroupTask} from './base-group-task';
import {Group, Member, MemberType} from '../../members/interfaces/member';
import {GroupExtra} from '../../../interfaces/group-extra';
import {MemberService} from '../../members/db-service';
import {ItemService} from '../../items/db-service';
import {ItemMembershipService} from '../../item-memberships/db-service';
import {GroupMembershipService} from '../../group-memberships/db-service';
import {DatabaseTransactionHandler} from '../../../plugins/database';
import {BaseItem} from '../../items/base-item';
import {BaseItemMembership} from '../../item-memberships/base-item-membership';
import {PermissionLevel} from '../../item-memberships/interfaces/item-membership';
import {BaseGroupMembership} from '../../group-memberships/base-group-membership';
import {GroupMembershipExists, GroupNotFound} from '../../../util/graasp-error';
import {GroupService} from '../db-service';

export class CreateGroupTask extends BaseGroupTask<Group> {
  get name(): string { return CreateGroupTask.name; }

  constructor(
    member: Member,
    data: Partial<Group>,
    memberService: MemberService,
    itemService: ItemService,
    groupService: GroupService,
    itemMembershipService: ItemMembershipService,
    groupMembershipService: GroupMembershipService,
    parentId?: string
  ) {
    super(
      member, memberService,itemService,groupService,itemMembershipService,groupMembershipService);
    this.data = data;
    this.parentId = parentId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const { name,email } = this.data;

    const groupEmail = email ? email : `${name}.${Date.now()}@graasp.org`;

    const { id: actorId } = this.actor;

    const groupData = {
      name,
      email: groupEmail,
      type: MemberType.Group,
    };

    let group = await this.memberService.create<GroupExtra>(groupData,handler);

    let rootItem = new BaseItem(
      `${name} Root Folder`,
      'Root Folder',
      'rootFolder',
      {},
      group.id,
      );

    rootItem = await this.itemService.create(rootItem,handler);

    const groupExtra = {
      creator: {
        memberId: actorId
      },
      rootFolder: {
        itemId: rootItem.id
      }
    };

    group = await this.memberService.update<GroupExtra>(group.id,{extra:groupExtra},handler);

    const groupRootItemMembership = new BaseItemMembership(
      group.id,
      rootItem.path,
      PermissionLevel.Read,
      group.id);

    const creatorRootItemMembership = new BaseItemMembership(
      actorId,
      rootItem.path,
      PermissionLevel.Admin,
      group.id);

    await this.itemMembershipService.create(groupRootItemMembership,handler);
    await this.itemMembershipService.create(creatorRootItemMembership,handler);

    const groupMembership = new BaseGroupMembership(actorId,group.id);

    await this.groupMembershipService.create(groupMembership,handler);

    if(this.parentId) {

      const membership = await this.groupMembershipService.checkMembership(actorId,this.parentId,handler);
      if(!membership) throw new GroupMembershipExists({member: actorId, group: this.parentId});

      const parentGroup = await this.memberService.get(this.parentId,handler);
      if(!parentGroup) throw new GroupNotFound(this.parentId);

      const groupParentMembership = new BaseGroupMembership(group.id,parentGroup.id);
      await this.groupMembershipService.create(groupParentMembership,handler);
    }
    this.status = 'OK';
    this._result = group;
  }
}
