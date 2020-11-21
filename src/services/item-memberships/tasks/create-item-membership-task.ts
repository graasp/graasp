// global
import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { BaseItemMembership } from '../base-item-membership';
import { ItemMembership, PermissionLevelCompare } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';

class CreateItemMembershipSubTask extends BaseItemMembershipTask {
  get name() { return CreateItemMembershipSubTask.name; }
  private membership: ItemMembership;

  constructor(member: Member, membership: ItemMembership,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.membership = membership;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    const itemMembership = await this.itemMembershipService.create(this.membership, handler);

    this._status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

export class CreateItemMembershipTask extends BaseItemMembershipTask {
  get name(): string { return CreateItemMembershipTask.name; }

  constructor(member: Member, data: Partial<ItemMembership>, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this._status = TaskStatus.Running;

    // get item that the new membership will target
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) this.failWith(new GraaspError(GraaspError.ItemNotFound, this.itemId));

    // verify if member adding the new membership has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotAdminItem, this.itemId));

    const itemMembership =
      new BaseItemMembership(this.data.memberId, item.path, this.data.permission, this.actor.id);
    const newMember = { id: itemMembership.memberId } as Member;

    // check member's membership "at" item
    const inheritedMembership =
      await this.itemMembershipService.getInherited(newMember, item, handler, true);

    if (inheritedMembership) {
      const { itemPath, permission: inheritedPermission } = inheritedMembership;

      // fail if trying to add a new membership for the same member and item
      if (itemPath === item.path) {
        this.failWith(new GraaspError(GraaspError.ModifyExisting, inheritedMembership.id));
      }

      const { permission: newPermission } = itemMembership;

      if (PermissionLevelCompare.lte(newPermission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission level than
        // the one inherited from the membership "above"
        this.failWith(new GraaspError(GraaspError.InvalidMembership, this.data));
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow =
      await this.itemMembershipService.getAllBelow(newMember, item, handler);

    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const { permission: newPermission } = itemMembership;

      const membershipsBelowToDiscard =
        membershipsBelow.filter(m => PermissionLevelCompare.lte(m.permission, newPermission));

      if (membershipsBelowToDiscard.length > 0) {
        this._status = TaskStatus.Delegated;

        // return subtasks to remove redundant existing memberships and to create the new one
        return membershipsBelowToDiscard
          .map(m => new DeleteItemMembershipSubTask(
            this.actor, m.id, this.itemService, this.itemMembershipService
          ))
          .concat(new CreateItemMembershipSubTask(
            this.actor, itemMembership, this.itemService, this.itemMembershipService
          ));

      }
    }

    // create membership
    this._result = await this.itemMembershipService.create(itemMembership, handler);
    this._status = TaskStatus.OK;
  }
}
