// global
import { FastifyLoggerInstance } from 'fastify';
import { TooManyDescendants } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_DESCENDANTS_FOR_DELETE } from '../../../util/config';
// other services
import { Member } from '../../members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';

type DeleteItemSubTaskInput= { itemId: string }

export class DeleteItemSubTask extends BaseItemTask<Item> {
  get name() {
    // return main task's name so it is injected with the same hook handlers
    return DeleteItemTask.name;
  }

  input: { itemId: string };

  constructor(member: Member, itemService: ItemService, input: DeleteItemSubTaskInput) {
    super(member, itemService);
    this.input = input;
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance) {
    this.status = 'RUNNING';

    const { itemId } = this.input;
    this.targetId = itemId;

    await this.preHookHandler?.({ id: itemId }, this.actor, { log, handler });
    const item = await this.itemService.delete(itemId, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = 'OK';
    this._result = item;
  }
}

type DeleteItemTaskInput = { item?: Item };

export class DeleteItemTask extends BaseItemTask<Item> {
  get name(): string {
    return DeleteItemTask.name;
  }
  private subtasks: DeleteItemSubTask[];

  input: DeleteItemTaskInput;
  getInput: () => DeleteItemTaskInput;

  constructor(member: Member, itemService: ItemService, input?: DeleteItemTaskInput) {
    const partialSubtasks = true;
    super(member, itemService, partialSubtasks); // partial execution of subtasks
    this.input = input ?? {};
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

    const { item } = this.input;
    const { id: itemId } = item;
    this.targetId = item.id;

    // get descendants
    const descendants = await this.itemService.getDescendants(item, handler, 'DESC', 'ALL', ['id']);

    // check how "big the tree is" below the item
    if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
      throw new TooManyDescendants(itemId);
    } else if (descendants.length > 0) {
      this.status = 'DELEGATED';

      // return list of subtasks for task manager to execute and
      // delete item + all descendants, one by one.
      this.subtasks = descendants
        .concat(item)
        .map(d => new DeleteItemSubTask(this.actor, this.itemService, { itemId: d.id }));

      return this.subtasks;
    }

    await this.preHookHandler?.(item, this.actor, { log, handler });
    // item has no descendents - delete item and return it as the result
    await this.itemService.delete(itemId, handler);
    await this.postHookHandler?.(item, this.actor, { log, handler });

    this.status = 'OK';
    this._result = item;
  }
}
