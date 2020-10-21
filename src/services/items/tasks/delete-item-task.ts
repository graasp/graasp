// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus, PostHookHandlerType } from 'interfaces/task';
import { MAX_DESCENDANTS_FOR_DELETE } from 'util/config';
// other services
import { ItemMembershipService } from 'services/item-memberships/db-service';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';

class DeleteItemSubTask extends BaseItemTask {
  get name() { return DeleteItemSubTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    postHookHandler?: PostHookHandlerType<Item>) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
    this.postHookHandler = postHookHandler;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this._status = TaskStatus.Running;

    const item = await this.itemService.delete(this.targetId, handler);
    this.postHookHandler?.(item, log);

    this._status = TaskStatus.OK;
    this._result = item;
  }
}

export class DeleteItemTask extends BaseItemTask {
  get name() { return DeleteItemTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    postHookHandler?: PostHookHandlerType<Item>) {
    super(member, itemService, itemMembershipService, true); // partial execution of subtasks
    this.targetId = itemId;
    this.postHookHandler = postHookHandler;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this._status = TaskStatus.Running;

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) this.failWith(new GraaspError(GraaspError.ItemNotFound, this.targetId));

    // verify membership rights over item
    const hasRights = await this.itemMembershipService.canAdmin(this.actor, item, handler);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotAdminItem, this.targetId));

    // get descendants
    const descendants =
      await this.itemService.getDescendants(item, handler, 'DESC', 'ALL', ['id']);

    // check how "big the tree is" below the item
    if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
      this.failWith(new GraaspError(GraaspError.TooManyDescendants, this.targetId));
    } else if (descendants.length > 0) {
      this._status = TaskStatus.Delegated;

      // return list of subtasks for task manager to execute and
      // delete item + all descendants, one by one.
      return descendants
        .concat(item)
        .map(d => new DeleteItemSubTask(this.actor, d.id, this.itemService, this.itemMembershipService, this.postHookHandler));
    }

    // item has no descendents - delete item and return it as the result
    await this.itemService.delete(this.targetId, handler);
    this.postHookHandler?.(item, log);

    this._status = TaskStatus.OK;
    this._result = item;
  }
}
