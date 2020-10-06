// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// other services
import { ItemService } from 'services/items/db-service';
import { Item } from 'services/items/interfaces/item';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';

export class DeleteItemMembershipSubTask extends BaseItemMembershipTask {
  get name() { return DeleteItemMembershipSubTask.name; }

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    const itemMembership = await this.itemMembershipService.delete(this.targetId, handler);

    this._status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

export class DeleteItemMembershipTask extends BaseItemMembershipTask {
  get name() { return DeleteItemMembershipTask.name; }

  private purgeBelow: boolean;

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    purgeBelow?: boolean) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
    this.purgeBelow = purgeBelow;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) this.failWith(new GraaspError(GraaspError.ItemMembershipNotFound, this.targetId));

    // skip if trying to remove member's own membership
    if (itemMembership.memberId !== this.actor.id) {
      // get item to which the membership is bound to
      const item = await this.itemService.getMatchingPath(itemMembership.itemPath, handler);

      // verify if member deleting the membership has rights for that
      const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
      if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotAdminItem, item.id));
    }

    if (this.purgeBelow) {
      const member = { id: itemMembership.memberId } as Member;
      const item = { path: itemMembership.itemPath } as Item;

      const itemMembershipsBelow =
        await this.itemMembershipService.getAllBelow(member, item, handler);

      if (itemMembershipsBelow.length > 0) {
        this._status = TaskStatus.Delegated;

        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        return itemMembershipsBelow
          .concat(itemMembership)
          .map(im => new DeleteItemMembershipSubTask(this.actor, im.id, this.itemService, this.itemMembershipService));
      }
    }

    // delete membership
    await this.itemMembershipService.delete(this.targetId, handler);
    this._status = TaskStatus.OK;
    this._result = itemMembership;
  }
}
