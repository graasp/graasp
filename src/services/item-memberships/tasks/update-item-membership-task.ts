// global
import { InvalidPermissionLevel, ItemMembershipNotFound, UserCannotAdminItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership, PermissionLevelCompare, PermissionLevel } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';

class UpdateItemMembershipSubTask extends BaseItemMembershipTask {
  get name() { return UpdateItemMembershipSubTask.name; }
  private permission: PermissionLevel;

  constructor(member: Member, itemMembershipId: string, permission: PermissionLevel,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.permission = permission;
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = 'RUNNING';

    const itemMembership = await this.itemMembershipService.update(this.targetId, this.permission, handler);

    this._status = 'OK';
    this._result = itemMembership;
  }
}

export class UpdateItemMembershipTask extends BaseItemMembershipTask {
  get name(): string { return UpdateItemMembershipTask.name; }

  constructor(member: Member, itemMembershipId: string, data: Partial<ItemMembership>,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this._status = 'RUNNING';

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) this.failWith(new ItemMembershipNotFound(this.targetId));

    // get item that membership is targeting
    const item = await this.itemService.getMatchingPath(itemMembership.itemPath, handler);

    // verify if member updating the membership has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
    if (!hasRights) this.failWith(new UserCannotAdminItem(item.id));

    // check member's inherited membership
    const member = { id: itemMembership.memberId } as Member;
    const inheritedMembership =
      await this.itemMembershipService.getInherited(member, item, handler);

    const { permission } = this.data;

    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        const deleteSubtask =
          new DeleteItemMembershipSubTask(this.actor, this.targetId, this.itemService, this.itemMembershipService);

        this._status = 'DELEGATED';
        return [deleteSubtask];
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        this.failWith(new InvalidPermissionLevel(this.targetId));
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow =
      await this.itemMembershipService.getAllBelow(member, item, handler);

    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard =
        membershipsBelow.filter(m => PermissionLevelCompare.lte(m.permission, permission));

      if (membershipsBelowToDiscard.length > 0) {
        this._status = 'DELEGATED';

        // return subtasks to remove redundant existing memberships and to update the existing one
        return membershipsBelowToDiscard
          .map(m => new DeleteItemMembershipSubTask(
            this.actor, m.id, this.itemService, this.itemMembershipService
          ))
          .concat(new UpdateItemMembershipSubTask(
            this.actor, this.targetId, permission, this.itemService, this.itemMembershipService
          ));
      }
    }

    // update membership
    this._result = await this.itemMembershipService.update(this.targetId, permission, handler);
    this._status = 'OK';
  }
}
