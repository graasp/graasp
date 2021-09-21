// global
import { FastifyLoggerInstance } from 'fastify';
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
import { TaskStatus } from '../../../interfaces/task';

class UpdateItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name() {
    // return main task's name so it is injected with the same hook handlers
    return UpdateItemMembershipTask.name;
  }
  private permission: PermissionLevel;

  constructor(member: Member, itemMembershipId: string, permission: PermissionLevel,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.permission = permission;
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = TaskStatus.RUNNING;

    await this.preHookHandler?.({ id: this.targetId, permission: this.permission }, this.actor, { log, handler });
    const itemMembership = await this.itemMembershipService.update(this.targetId, this.permission, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

export class UpdateItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string { return UpdateItemMembershipTask.name; }

  constructor(member: Member, itemMembershipId: string, data: Partial<ItemMembership>,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this.status = TaskStatus.RUNNING;

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) throw new ItemMembershipNotFound(this.targetId);

    // get item that membership is targeting
    const item = await this.itemService.getMatchingPath(itemMembership.itemPath, handler);

    // verify if member updating the membership has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor.id, item, handler);
    if (!hasRights) throw new UserCannotAdminItem(item.id);

    // check member's inherited membership
    const { memberId } = itemMembership;
    const inheritedMembership =
      await this.itemMembershipService.getInherited(memberId, item, handler);

    const { permission } = this.data;

    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        const deleteSubtask =
          new DeleteItemMembershipSubTask(this.actor, this.targetId, this.itemService, this.itemMembershipService);

        this.status = TaskStatus.DELEGATED;
        return [deleteSubtask];
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        throw new InvalidPermissionLevel(this.targetId);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow =
      await this.itemMembershipService.getAllBelow(memberId, item, handler);

    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard =
        membershipsBelow.filter(m => PermissionLevelCompare.lte(m.permission, permission));

      if (membershipsBelowToDiscard.length > 0) {
        this.status = TaskStatus.DELEGATED;

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
    this.status = TaskStatus.OK;
  }
}
