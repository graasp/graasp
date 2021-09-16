// global
import { FastifyLoggerInstance } from 'fastify';
import { ItemNotFound, TooManyDescendants, UserCannotAdminItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_DESCENDANTS_FOR_DELETE } from '../../../util/config';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';

class DeleteItemSubTask extends BaseItemTask<Item> {
  get name() {
    // return main task's name so it is injected with the same hook handlers
    return DeleteItemTask.name;
  }

  constructor(
    member: Member,
    itemId: string,
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
  ) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = 'RUNNING';

    await this.preHookHandler?.({ id: this.targetId }, this.actor, { log, handler });
    const item = await this.itemService.delete(this.targetId, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = 'OK';
    this._result = item;
  }
}

export class DeleteItemTask extends BaseItemTask<Item> {
  get name(): string {
    return DeleteItemTask.name;
  }
  private subtasks: DeleteItemSubTask[];

  constructor(
    member: Member,
    itemId: string,
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
  ) {
    const partialSubtasks = true;
    super(member, itemService, itemMembershipService, partialSubtasks); // partial execution of subtasks
    this.targetId = itemId;
  }

  get result(): Item {
    // if item has no descendants or subtasks are still 'New'
    if (!this.subtasks || this.subtasks.some((st) => st.status === 'NEW')) return this._result;

    // return the result of the last subtask that executed successfully,
    // in other words, the last deleted item
    return this.subtasks.filter((st) => st.status === 'OK').pop().result;
  }

  async run(
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<DeleteItemSubTask[]> {
    this.status = 'RUNNING';

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // verify membership rights over item
    const hasRights = await this.itemMembershipService.canAdmin(this.actor.id, item, handler);
    if (!hasRights) throw new UserCannotAdminItem(this.targetId);

    // get descendants
    const descendants = await this.itemService.getDescendants(item, handler, 'DESC', 'ALL', ['id']);

    // check how "big the tree is" below the item
    if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
      throw new TooManyDescendants(this.targetId);
    } else if (descendants.length > 0) {
      this.status = 'DELEGATED';

      // return list of subtasks for task manager to execute and
      // delete item + all descendants, one by one.
      this.subtasks = descendants
        .concat(item)
        .map(
          (d) =>
            new DeleteItemSubTask(this.actor, d.id, this.itemService, this.itemMembershipService),
        );

      return this.subtasks;
    }

    await this.preHookHandler?.(item, this.actor, { log, handler });
    // item has no descendents - delete item and return it as the result
    await this.itemService.delete(this.targetId, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = 'OK';
    this._result = item;
  }
}
