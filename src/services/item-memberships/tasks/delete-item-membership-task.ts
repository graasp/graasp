// global
import { ItemMembershipNotFound, UserCannotAdminItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Item } from '../../../services/items/interfaces/item';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';

export class DeleteItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string { return DeleteItemMembershipSubTask.name; }

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const itemMembership = await this.itemMembershipService.delete(this.targetId, handler);

    this.status = 'OK';
    this._result = itemMembership;
  }
}

export class DeleteItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string { return DeleteItemMembershipTask.name; }

  private purgeBelow: boolean;

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    purgeBelow?: boolean) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
    this.purgeBelow = purgeBelow;
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this.status = 'RUNNING';

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) throw new ItemMembershipNotFound(this.targetId);

    // skip if trying to remove member's own membership
    if (!this.skipActorChecks && itemMembership.memberId !== this.actor.id) {
      // get item to which the membership is bound to
      const item = await this.itemService.getMatchingPath(itemMembership.itemPath, handler);

      // verify if member deleting the membership has rights for that
      const hasRights = await this.itemMembershipService.canAdmin(this.actor.id, item, handler);
      if (!hasRights) throw new UserCannotAdminItem(item.id);
    }

    if (this.purgeBelow) {
      const item = { path: itemMembership.itemPath } as Item;

      const itemMembershipsBelow =
        await this.itemMembershipService.getAllBelow(itemMembership.memberId, item, handler);

      if (itemMembershipsBelow.length > 0) {
        this.status = 'DELEGATED';

        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        return itemMembershipsBelow
          .concat(itemMembership)
          .map(im => new DeleteItemMembershipSubTask(this.actor, im.id, this.itemService, this.itemMembershipService));
      }
    }

    // delete membership
    await this.itemMembershipService.delete(this.targetId, handler);
    this.status = 'OK';
    this._result = itemMembership;
  }
}
