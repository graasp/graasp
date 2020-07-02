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

export class DeleteItemMembershipTask extends BaseItemMembershipTask {
  get name() { return DeleteItemMembershipTask.name; }

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
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

    // delete membership
    await this.itemMembershipService.delete(this.targetId, handler);
    this._status = TaskStatus.OK;
    this._result = itemMembership;
  }
}
