// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// other services
import { ItemService } from 'services/items/db-service';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership, PermissionLevelCompare } from '../interfaces/item-membership';

export class UpdateItemMembershipTask extends BaseItemMembershipTask {
  get name() { return UpdateItemMembershipTask.name; }

  constructor(member: Member, itemMembershipId: string, data: Partial<ItemMembership>,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) this.failWith(new GraaspError(GraaspError.ItemMembershipNotFound, this.targetId));

    // get item that membership is targeting
    const item = await this.itemService.getMatchingPath(itemMembership.itemPath, handler);

    // verify if member updating the membership has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotAdminItem, item.id));

    // check member's inherited membership
    const member = { id: itemMembership.memberId } as Member;
    const inheritedMembership =
      await this.itemMembershipService.getInherited(member, item, handler);

    const { permission } = this.data;

    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        await this.itemMembershipService.delete(this.targetId, handler);

        this._result = inheritedMembership;
        this._status = TaskStatus.OK;

        return;
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        this.failWith(new GraaspError(GraaspError.InvalidPermissionLevel, this.targetId));
      }
    }

    // update membership
    this._result = await this.itemMembershipService.update(this.targetId, permission, handler);
    this._status = TaskStatus.OK;
  }
}
