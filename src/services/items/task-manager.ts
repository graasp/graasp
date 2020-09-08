// global
import { FastifyLoggerInstance } from 'fastify';
import { Database } from 'plugins/database';
// other services
import { Member } from 'services/members/interfaces/member';
import { ItemMembershipService } from 'services/item-memberships/db-service';
import { TaskHookMoment, PreHookHandlerType, PostHookHandlerType } from 'interfaces/task';
// local
import { ItemService } from './db-service';
import { Item } from './interfaces/item';
import { BaseTaskManager } from 'services/base-task-manager';
import { GetItemTask } from './tasks/get-item-task';
import { GetItemChildrenTask } from './tasks/get-item-children-task';
import { CreateItemTask } from './tasks/create-item-task';
import { UpdateItemTask } from './tasks/update-item-task';
import { DeleteItemTask } from './tasks/delete-item-task';
import { MoveItemTask } from './tasks/move-item-task';
import { CopyItemTask } from './tasks/copy-item-task';

export class ItemTaskManager extends BaseTaskManager<Item> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    database: Database, logger: FastifyLoggerInstance
  ) {
    super(database, logger);
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  private tasksHooks = new Map<string, {
    pre?: { handlers: Function[]; wrapped: PreHookHandlerType<Item> };
    post?: { handlers: Function[]; wrapped: PostHookHandlerType<Item> };
  }>();

  private wrapTaskHookHandlers(taskName: string, moment: TaskHookMoment, handlers: Function[]) {
    if (moment === 'pre') {
      // 'pre' handlers executions '(a)wait', and if one fails, the task execution
      // is interrupted - throws exception.
      return async (data: Partial<Item>) => {
        try {
          for (let i = 0; i < handlers.length; i++) {
            await handlers[i](data);
          }
        } catch (error) {
          const { id, type, extra } = data;
          this.logger.error(error,
            `${taskName}: ${moment} hook fail, item ${JSON.stringify({ id, type, extra })}`);
          throw error;
        }
      };
    } else if (moment === 'post') {
      // 'post' handlers executions do not '(a)wait', and if any fails, execution
      // continues with a warning
      return (item: Item) => {
        for (let i = 0; i < handlers.length; i++) {
          try {
            handlers[i](item);
          } catch (error) {
            const { id, type, extra } = item;
            this.logger.warn(error,
              `${taskName}: ${moment} hook fail, item ${JSON.stringify({ id, type, extra })}`);
          }
        }
      };
    }
  }

  private setTaskHookHandler(taskName: string, moment: TaskHookMoment, handler: Function) {
    let hooks = this.tasksHooks.get(taskName);

    if (!hooks || !hooks[moment]) {
      if (!hooks) {
        hooks = {};
        this.tasksHooks.set(taskName, hooks);
      }

      const handlers: Function[] = [];
      // generated fn keeps a ref to the list of `handlers`;
      // only one fn generated per type of task, per hook moment.
      const wrapped = this.wrapTaskHookHandlers(taskName, moment, handlers);

      hooks[moment] = { handlers, wrapped };
    }

    hooks[moment].handlers.push(handler);
  }

  private unsetTaskHookHandler(taskName: string, moment: TaskHookMoment, handler: Function) {
    const handlers = this.tasksHooks.get(taskName)?.[moment]?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);

      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }

  setPostDeleteHandler(handler: Function) {
    this.setTaskHookHandler(DeleteItemTask.name, 'post', handler);
  }

  unsetPostDeleteHandler(handler: Function) {
    this.unsetTaskHookHandler(DeleteItemTask.name, 'post', handler);
  }

  // Tasks
  createGetTask(member: Member, itemId: string) {
    return new GetItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createGetChildrenTask(member: Member, itemId: string) {
    return new GetItemChildrenTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createCreateTask(member: Member, data: Partial<Item>, parentId?: string) {
    return new CreateItemTask(member, data, this.itemService, this.itemMembershipService, parentId);
  }

  createUpdateTask(member: Member, itemId: string, data: Partial<Item>) {
    return new UpdateItemTask(member, itemId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemId: string) {
    const postHookHandler = this.tasksHooks.get(DeleteItemTask.name)?.post?.wrapped;
    return new DeleteItemTask(member, itemId, this.itemService, this.itemMembershipService, postHookHandler);
  }

  createMoveTask(member: Member, itemId: string, parentId?: string) {
    return new MoveItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createCopyTask(member: Member, itemId: string, parentId?: string) {
    return new CopyItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }
}
