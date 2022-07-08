import { FastifyLoggerInstance } from 'fastify';

import {
  DatabaseTransactionHandler,
  Item,
  ItemMembership,
  ItemMembershipService,
  Member,
  PermissionLevel,
  PermissionLevelCompare,
  TaskStatus,
} from '@graasp/sdk';

import { InvalidPermissionLevel } from '../../../util/graasp-error';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';

class UpdateItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name() {
    // return main task's name so it is injected with the same hook handlers
    return UpdateItemMembershipTask.name;
  }
  input: { itemMembershipId?: string; permission?: PermissionLevel };

  constructor(
    member: Member,
    itemMembershipService: ItemMembershipService,
    input: { itemMembershipId?: string; permission?: PermissionLevel },
  ) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = TaskStatus.RUNNING;

    const { itemMembershipId, permission } = this.input;
    this.targetId = itemMembershipId;

    await this.preHookHandler?.({ id: itemMembershipId, permission }, this.actor, { log, handler });
    const itemMembership = await this.itemMembershipService.update(
      itemMembershipId,
      permission,
      handler,
    );
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

type InputType = {
  itemMembership?: ItemMembership;
  item?: Item;
  data?: Partial<ItemMembership>;
};

export class UpdateItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    return UpdateItemMembershipTask.name;
  }
  private subtasks: BaseItemMembershipTask<ItemMembership>[];

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  get result(): ItemMembership {
    return this.subtasks ? this.subtasks[this.subtasks.length - 1]?.result : this._result;
  }

  async run(
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<BaseItemMembershipTask<ItemMembership>[]> {
    this.status = TaskStatus.RUNNING;

    const { itemMembership, item, data } = this.input;
    this.targetId = itemMembership.id;

    // check member's inherited membership
    const { memberId, id: itemMembershipId } = itemMembership;
    const inheritedMembership = await this.itemMembershipService.getInherited(
      memberId,
      item,
      handler,
    );

    const { permission } = data;

    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        const deleteSubtask = new DeleteItemMembershipSubTask(
          this.actor,
          this.itemMembershipService,
          { itemMembershipId },
        );

        this.status = TaskStatus.DELEGATED;
        this.subtasks = [deleteSubtask];
        return this.subtasks;
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        throw new InvalidPermissionLevel(itemMembershipId);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.itemMembershipService.getAllBelow(memberId, item, handler);
    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, permission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        this.status = TaskStatus.DELEGATED;

        // return subtasks to remove redundant existing memberships and to update the existing one
        this.subtasks = membershipsBelowToDiscard.map(
          (m) =>
            new DeleteItemMembershipSubTask(this.actor, this.itemMembershipService, {
              itemMembershipId: m.id,
            }),
        );
        this.subtasks.push(
          new UpdateItemMembershipSubTask(this.actor, this.itemMembershipService, {
            itemMembershipId,
            permission,
          }),
        );

        return this.subtasks;
      }
    }

    // update membership
    await this.preHookHandler?.({ id: itemMembershipId, permission }, this.actor, { log, handler });
    const updatedItemMembership = await this.itemMembershipService.update(
      itemMembershipId,
      permission,
      handler,
    );
    await this.postHookHandler?.(updatedItemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = updatedItemMembership;
  }
}
