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
import { BaseItemMembership } from '../base-item-membership';
import { ItemMembership, PermissionLevelCompare } from '../interfaces/item-membership';

export class CreateItemMembershipTask extends BaseItemMembershipTask {
  get name() { return CreateItemMembershipTask.name; }

  constructor(member: Member, data: Partial<ItemMembership>, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get item to which the new membership will be added
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) this.failWith(new GraaspError(GraaspError.ItemNotFound, this.itemId));

    // verify if member adding the new membership has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotAdminItem, this.itemId));

    const itemMembership =
      new BaseItemMembership(this.data.memberId, item.path, this.data.permission, this.actor.id);
    const newMember = { id: itemMembership.memberId } as Member;

    // check new member's inherited memberships
    const inheritedMembership =
      await this.itemMembershipService.getInherited(newMember, item, handler);

    if (inheritedMembership) {
      const { itemPath, permission: inheritedPermission } = inheritedMembership;

      // fail if trying to add a new membership for the same member and item
      if (itemPath === item.path) {
        this.failWith(new GraaspError(GraaspError.ModifyExisting, inheritedMembership.id));
      }

      const { permission: newPermission } = itemMembership;

      if (PermissionLevelCompare.lte(newPermission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission lvl than
        // the one inherited from the membership "above"
        this.failWith(new GraaspError(GraaspError.InvalidMembership, this.data));
      }
    }

    // create membership
    this._result = await this.itemMembershipService.create(itemMembership, handler);
    this._status = TaskStatus.OK;
  }
}
