// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from '../util/graasp-error';
import { Database, DatabasePoolHandler } from '../plugins/database';

import { TaskManager } from '../interfaces/task-manager';
import { Task, TaskStatus, PreHookHandlerType, PostHookHandlerType } from '../interfaces/task';
import { Actor } from '../interfaces/actor';
import { Result } from '../interfaces/result';

export abstract class BaseTaskManager<T extends Result> implements TaskManager<Actor, T> {
  private databasePool: DatabasePoolHandler;
  protected logger: FastifyLoggerInstance;

  constructor(database: Database, logger: FastifyLoggerInstance) {
    this.databasePool = database.pool;
    this.logger = logger;
  }

  private handleTaskFinish(task: Task<Actor, T>, log: FastifyLoggerInstance) {
    const { name, actor: { id: actorId }, targetId, status, message: taskMessage, result } = task;

    let message = `${name}: ` +
      `actor '${actorId}'`;

    if (targetId) message += `, target '${targetId}'`;
    message += `, status '${status}'`;
    if (result) message += `, result '${Array.isArray(result) ? result.map(({ id }) => id) : result.id}'`;
    if (taskMessage) message += `, message '${taskMessage}'`;

    switch (status) {
      case TaskStatus.OK:
      case TaskStatus.Delegated:
      case TaskStatus.Running: log.info(message); break;
      case TaskStatus.Partial: log.warn(message); break;
      case TaskStatus.Fail: log.error(message); break;
      default: log.debug(message);
    }

    // TODO: push notification to client in case the task signals it.
  }

  /**
   * Run each task, and any subtasks, in a transaction.
   * Depending on the task, if something goes wrong, the whole task is might canceled/reverted.
   *
   * @param task Task to run
   * @param log Logger instance
   * @returns The task's `result`. If it has subtasks, whatever (task/subtask) result that
   * should represent the "global" result (dependant on task implementation).
   */
  private async runTransactionally(task: Task<Actor, T>, log: FastifyLoggerInstance): Promise<T | T[]> {
    return this.databasePool.transaction(async (handler) => {
      let subtasks;

      // run task
      try {
        subtasks = await task.run(handler, log);
        this.handleTaskFinish(task, log);
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(task, log);
        }
        throw error;
      }

      // if there's no subtasks, return task result
      if (!subtasks) return task.result;

      let subtask: Task<Actor, T>;

      // run subtasks
      if (task.partialSubtasks) {
        // if a subtask fails, stop. finished (sub)tasks are not reverted/rolledback.
        try {
          for (let i = 0; i < subtasks.length; i++) {
            subtask = subtasks[i];
            await handler.transaction(async nestedHandler => subtask.run(nestedHandler, log));
            this.handleTaskFinish(subtask, log);
          }
        } catch (error) {
          if (error instanceof GraaspError) {
            this.handleTaskFinish(subtask, log);
          } else {
            log.error(error);
          }
        }
      } else {
        // if a subtask fails, stop and all is reverted/rolledback.
        try {
          for (let i = 0; i < subtasks.length; i++) {
            subtask = subtasks[i];
            await subtask.run(handler, log);
          }
          subtasks.forEach(st => this.handleTaskFinish(st, log));
        } catch (error) {
          if (error instanceof GraaspError) {
            this.handleTaskFinish(subtask, log);
          }
          throw error;
        }
      }

      return task.result;
    });
  }

  /**
   * Run given tasks.
   * * If only one task, run task and return the task's result: value or error.
   * * If >1 task, run tasks, collect results (values or errors) and return an array with everything.
   *
   * @param tasks List of tasks to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  async run(tasks: Task<Actor, T>[], log = this.logger): Promise<void | T | T[]> {
    if (tasks.length === 1) {
      return this.runTransactionally(tasks[0], log);
    }

    const result = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        const taskResult = await this.runTransactionally(task, log);
        result.push(taskResult);
      } catch (error) {
        // log unexpected errors and continue
        if (!(error instanceof GraaspError)) {
          log.error(error.message || error); // TODO: improve?
        }
        result.push(error);
      }
    }

    return result;
  }

  abstract createCreateTask(actor: Actor, object: Partial<T>, extra?: unknown): Task<Actor, T>;
  abstract createGetTask(actor: Actor, objectId: string): Task<Actor, T>;
  abstract createUpdateTask(actor: Actor, objectId: string, object: Partial<T>): Task<Actor, T>;
  abstract createDeleteTask(actor: Actor, objectId: string): Task<Actor, T>;

  // Hooks
  protected tasksHooks = new Map<string, {
    pre?: { handlers: PreHookHandlerType<T>[]; wrapped: PreHookHandlerType<T> };
    post?: { handlers: PostHookHandlerType<T>[]; wrapped: PostHookHandlerType<T> };
  }>();

  private wrapTaskPreHookHandlers(taskName: string, handlers: PreHookHandlerType<T>[]) {
    // 'pre' handlers executions '(a)wait', and if one fails, the task execution is interrupted - throws exception.
    return async (data: Partial<T>, actor: Actor, log = this.logger) => {
      try {
        for (let i = 0; i < handlers.length; i++) {
          await handlers[i](data, actor, log);
        }
      } catch (error) {
        log.error(error, `${taskName}: pre hook fail, object ${JSON.stringify(data)}`);
        throw error;
      }
    };
  }

  private wrapTaskPostHookHandlers(taskName: string, handlers: PostHookHandlerType<T>[]) {
    // 'post' handlers executions do not '(a)wait', and if any fails, execution continues with a warning
    return (object: T, actor: Actor, log = this.logger) => {
      for (let i = 0; i < handlers.length; i++) {
        try {
          handlers[i](object, actor, log);
        } catch (error) {
          log.warn(error, `${taskName}: post hook fail, object ${JSON.stringify(object)}`);
        }
      }
    };
  }

  protected setTaskPreHookHandler(taskName: string, handler: PreHookHandlerType<T>): void {
    let hooks = this.tasksHooks.get(taskName);

    if (!hooks || !hooks.pre) {
      if (!hooks) {
        hooks = {};
        this.tasksHooks.set(taskName, hooks);
      }
      // generated "wrapped" fn keeps a ref to the list of `handlers`;
      // only one "wrapped" fn generated per type of task, per hook moment.
      const handlers: PreHookHandlerType<T>[] = [];
      const wrapped = this.wrapTaskPreHookHandlers(taskName, handlers);
      hooks.pre = { handlers, wrapped };
    }

    hooks.pre.handlers.push(handler as PreHookHandlerType<T>);
  }

  protected setTaskPostHookHandler(taskName: string, handler: PostHookHandlerType<T>): void {
    let hooks = this.tasksHooks.get(taskName);

    if (!hooks || !hooks.post) {
      if (!hooks) {
        hooks = {};
        this.tasksHooks.set(taskName, hooks);
      }
      // generated "wrapped" fn keeps a ref to the list of `handlers`;
      // only one "wrapped" fn generated per type of task, per hook moment.
      const handlers: PostHookHandlerType<T>[] = [];
      const wrapped = this.wrapTaskPostHookHandlers(taskName, handlers);
      hooks.post = { handlers, wrapped };
    }

    hooks.post.handlers.push(handler as PostHookHandlerType<T>);
  }

  protected unsetTaskPreHookHandler(taskName: string, handler: PreHookHandlerType<T>): void {
    const handlers = this.tasksHooks.get(taskName)?.pre?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);
      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }

  protected unsetTaskPostHookHandler(taskName: string, handler: PostHookHandlerType<T>): void {
    const handlers = this.tasksHooks.get(taskName)?.post?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);
      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }
}
