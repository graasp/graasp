// global
import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Item } from '../../../services/items/interfaces/item';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { TaskStatus } from '../../..';

export class DeleteItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    // return main task's name so it is injected with the same hook handlers
    return DeleteItemMembershipTask.name;
  }

  input: { itemMembershipId: string };

  constructor(
    member: Member,
    itemMembershipService: ItemMembershipService,
    input: { itemMembershipId: string },
  ) {
    super(member, itemMembershipService);
    this.input = input;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { itemMembershipId } = this.input;
    this.targetId = itemMembershipId;

    await this.preHookHandler?.({ id: itemMembershipId }, this.actor, { log, handler });
    const itemMembership = await this.itemMembershipService.delete(itemMembershipId, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}

type InputType = { itemMembership?: ItemMembership; purgeBelow?: boolean };

export class DeleteItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    return DeleteItemMembershipTask.name;
  }
  private subtasks: DeleteItemMembershipSubTask[];

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: InputType) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  get result(): ItemMembership {
    return this.subtasks ? this.subtasks[0]?.result : this._result;
  }

  async run(
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<DeleteItemMembershipSubTask[]> {
    this.status = TaskStatus.RUNNING;

    const { itemMembership, purgeBelow } = this.input;
    this.targetId = itemMembership.id;

    if (purgeBelow) {
      const item = { path: itemMembership.itemPath } as Item;

      const itemMembershipsBelow = await this.itemMembershipService.getAllBelow(
        itemMembership.memberId,
        item,
        handler,
      );

      if (itemMembershipsBelow.length > 0) {
        this.status = TaskStatus.DELEGATED;

        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        this.subtasks = itemMembershipsBelow.concat(itemMembership).map(
          ({ id: itemMembershipId }) =>
            new DeleteItemMembershipSubTask(this.actor, this.itemMembershipService, {
              itemMembershipId,
            }),
        );

        return this.subtasks;
      }
    }

    // delete membership
    await this.preHookHandler?.(itemMembership, this.actor, { log, handler });
    await this.itemMembershipService.delete(itemMembership.id, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = itemMembership;
  }
}
