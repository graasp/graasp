// global
import { FastifyLoggerInstance } from 'fastify';
import { InvalidMembership, ModifyExisting } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../../services/members/interfaces/member';
import { Item } from '../../items/interfaces/item';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { BaseItemMembership } from '../base-item-membership';
import { ItemMembership, PermissionLevelCompare } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';

type MembershipSubTaskInput = { data?: Partial<ItemMembership> };

export class CreateItemMembershipSubTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    // return main task's name so it is injected with the same hook handlers
    return CreateItemMembershipTask.name;
  }

  input: MembershipSubTaskInput;
  getInput: () => MembershipSubTaskInput;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: MembershipSubTaskInput) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = 'RUNNING';

    const { data } = this.input;

    // create item membership
    await this.preHookHandler?.(data, this.actor, { log, handler });
    const itemMembership = await this.itemMembershipService.create(data, handler);
    await this.postHookHandler?.(itemMembership, this.actor, { log, handler });

    this.status = 'OK';
    this._result = itemMembership;
  }
}

type MembershipTaskInput = { data?: Partial<ItemMembership>, item?: Item };

export class CreateItemMembershipTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string { return CreateItemMembershipTask.name; }
  private subtasks: BaseItemMembershipTask<ItemMembership>[];

  input: MembershipTaskInput;
  getInput: () => MembershipTaskInput;

  constructor(member: Member, itemMembershipService: ItemMembershipService, input?: MembershipTaskInput) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  get result(): ItemMembership {
    return this.subtasks ? this.subtasks[0]?.result : this._result;
  }

  async run(
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<BaseItemMembershipTask<ItemMembership>[]> {
    this.status = 'RUNNING';

    const { data, item } = this.input;
    this.targetId = item.id;

    const itemMembership =
      new BaseItemMembership(data.memberId, item.path, data.permission, this.actor.id);
    const { memberId } = itemMembership;

    // check member's membership "at" item
    const inheritedMembership = await this.itemMembershipService.getInherited(
      memberId,
      item,
      handler,
      true,
    );

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
        throw new InvalidMembership(data);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.itemMembershipService.getAllBelow(memberId, item, handler);

    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const { permission: newPermission } = itemMembership;

      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, newPermission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        this.status = 'DELEGATED';

        // return subtasks to remove redundant existing memberships and to create the new one
        this.subtasks = membershipsBelowToDiscard
          .map(({ id: itemMembershipId }) =>
            new DeleteItemMembershipSubTask(this.actor, this.itemMembershipService, { itemMembershipId })
          );

        this.subtasks.unshift(new CreateItemMembershipSubTask(this.actor, this.itemMembershipService, { data: itemMembership }));
        return this.subtasks;
      }
    }

    // create membership
    await this.preHookHandler?.(itemMembership, this.actor, { log, handler });
    const resultItemMembership = await this.itemMembershipService.create(itemMembership, handler);
    await this.postHookHandler?.(resultItemMembership, this.actor, { log, handler });

    this._result = resultItemMembership;
    this.status = 'OK';
  }
}
