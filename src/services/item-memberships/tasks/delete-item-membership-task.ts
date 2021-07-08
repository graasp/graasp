// global
import { FastifyLoggerInstance } from 'fastify';
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
  get name(): string {
    // return main task's name so it is injected with the same hook handlers
    return DeleteItemMembershipTask.name;
  }

  constructor(member: Member, itemMembershipId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemMembershipId;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = 'RUNNING';

    await this.preHookHandler?.({ id: this.targetId }, this.actor, { log });
    const itemMembership = await this.itemMembershipService.delete(this.targetId, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log });

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

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<DeleteItemMembershipSubTask[]> {
    this.status = 'RUNNING';

    // get item membership
    const itemMembership = await this.itemMembershipService.get(this.targetId, handler);
    if (!itemMembership) throw new ItemMembershipNotFound(this.targetId);

    // if trying to remove someone else's membership
    if (itemMembership.memberId !== this.actor.id && !this.skipActorChecks) {
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
          .map(im => {
            const t = new DeleteItemMembershipSubTask(this.actor, im.id, this.itemService, this.itemMembershipService);
            t.preHookHandler = this.preHookHandler;
            t.postHookHandler = this.postHookHandler;
            return t;
          });
      }
    }

    // delete membership
    await this.preHookHandler?.(itemMembership, this.actor, { log });
    await this.itemMembershipService.delete(this.targetId, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log });

    this.status = 'OK';
    this._result = itemMembership;
  }
}
