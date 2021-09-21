// global
import { FastifyLoggerInstance } from 'fastify';
import {
  InvalidMembership, ItemNotFound,
  ModifyExisting, UserCannotAdminItem
} from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { BaseItemMembership } from '../base-item-membership';
import { ItemMembership, PermissionLevelCompare } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';
import { TaskStatus } from '../../../interfaces/task';

class CreateItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name() {
    // return main task's name so it is injected with the same hook handlers
    return CreateItemMembershipTask.name;
  }
  private membership: ItemMembership;

  constructor(member: Member, membership: ItemMembership,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.membership = membership;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = TaskStatus.RUNNING;

    await this.preHookHandler?.(this.membership, this.actor, { log, handler });
    const itemMembership = await this.itemMembershipService.create(this.membership, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

export class CreateItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string { return CreateItemMembershipTask.name; }

  constructor(member: Member, data: Partial<ItemMembership>, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<BaseItemMembershipTask<ItemMembership>[]> {
    this.status = TaskStatus.RUNNING;

    // get item that the new membership will target
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) throw new ItemNotFound(this.itemId);

    // verify if member adding the new membership has rights for that
    // TODO: how about a parameter in run() or on task creation to skip these verification (it could be helpful for 'public')
    if (!this.skipActorChecks) {
      const hasRights = await this.itemMembershipService.canAdmin(this.actor.id, item, handler);
      if (!hasRights) throw new UserCannotAdminItem(this.itemId);
    }

    const itemMembership =
      new BaseItemMembership(this.data.memberId, item.path, this.data.permission, this.actor.id);
    const { memberId } = itemMembership;

    // check member's membership "at" item
    const inheritedMembership =
      await this.itemMembershipService.getInherited(memberId, item, handler, true);

    if (inheritedMembership) {
      const { itemPath, permission: inheritedPermission } = inheritedMembership;

      // fail if trying to add a new membership for the same member and item
      if (itemPath === item.path) {
        throw new ModifyExisting(inheritedMembership.id);
      }

      const { permission: newPermission } = itemMembership;

      if (PermissionLevelCompare.lte(newPermission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission level than
        // the one inherited from the membership "above"
        throw new InvalidMembership(this.data);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow =
      await this.itemMembershipService.getAllBelow(memberId, item, handler);

    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const { permission: newPermission } = itemMembership;

      const membershipsBelowToDiscard =
        membershipsBelow.filter(m => PermissionLevelCompare.lte(m.permission, newPermission));

      if (membershipsBelowToDiscard.length > 0) {
        this.status = TaskStatus.DELEGATED;

        // return subtasks to remove redundant existing memberships and to create the new one
        return membershipsBelowToDiscard
          .map(m => new DeleteItemMembershipSubTask(
            this.actor, m.id, this.itemService, this.itemMembershipService
          ))
          .concat(new CreateItemMembershipSubTask(this.actor, itemMembership, this.itemService, this.itemMembershipService));

      }
    }

    // create membership
    await this.preHookHandler?.(itemMembership, this.actor, { log, handler });
    const resultItemMembership = await this.itemMembershipService.create(itemMembership, handler);
    await this.postHookHandler?.(resultItemMembership, this.actor, { log, handler });

    this._result = resultItemMembership;
    this.status = TaskStatus.OK;
  }
}
