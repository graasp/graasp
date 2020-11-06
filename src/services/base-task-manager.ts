// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from 'util/graasp-error';
import { Database, DatabasePoolHandler, DatabaseTransactionHandler } from 'plugins/database';

import { TaskManager } from 'interfaces/task-manager';
import { Task, TaskStatus, TaskHookMoment, PreHookHandlerType, PostHookHandlerType } from 'interfaces/task';
import { Actor } from 'interfaces/actor';
import { Result } from 'interfaces/result';

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
   * If something goes wrong the whole task is canceled/reverted.
   *
   * @param task Task to run
   * @param log Logger instance
   * @returns Task's `result` or, if it has subtasks, the `result` of the last subtask.
   */
  private async runTransactionally(task: Task<Actor, T>, log: FastifyLoggerInstance): Promise<T | T[]> {
    return this.databasePool.transaction(async (handler) => {
      let taskResult: T | T[];
      let subtasks;

      // run task
      try {
        subtasks = await task.run(handler, log);
        taskResult = task.result;
        this.handleTaskFinish(task, log);
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(task, log);
        }
        throw error;
      }

      // if there's no subtasks, "register" the task finishing
      if (!subtasks) return taskResult;

      // if task's subtasks can "partially" execute
      if (task.partialSubtasks) return this.runTransactionallyNested(subtasks, handler, log);

      // run subtasks as "a whole"
      let subtask;

      try {
        for (let i = 0; i < subtasks.length; i++) {
          subtask = subtasks[i];
          await subtask.run(handler, log);
        }

        subtasks.forEach((st: Task<Actor, T>) => this.handleTaskFinish(st, log));

        // set the last subtask result as the result of the task
        // TODO: does this make sense?
        taskResult = subtasks[subtasks.length - 1].result;
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(subtask, log);
        }
        throw error;
      }

      return taskResult;
    });
  }

  /**
   * Run each subtask in a nested transaction.
   * If something goes wrong the execution stops at that point and returns.
   * Subtasks that ran successfully are not reverted/rolledback.
   *
   * @param subtasks Subtasks to run
   * @param handler Task's transactional handler
   * @param log Logger instance
   */
  private async runTransactionallyNested(subtasks: Task<Actor, T>[], handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<T | T[]> {
    return handler.transaction(async (nestedHandler) => {
      let subtask;
      let taskResult;

      try {
        for (let i = 0; i < subtasks.length; i++) {
          subtask = subtasks[i];

          await subtask.run(nestedHandler, log);
          taskResult = subtask.result;

          this.handleTaskFinish(subtask, log);
        }
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(subtask, log);
        }
        log.error(error);
      }

      return taskResult;
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

  abstract createCreateTask(actor: Actor, object: T, extra?: unknown): Task<Actor, T>;
  abstract createGetTask(actor: Actor, objectId: string): Task<Actor, T>;
  abstract createUpdateTask(actor: Actor, objectId: string, object: Partial<T>): Task<Actor, T>;
  abstract createDeleteTask(actor: Actor, objectId: string): Task<Actor, T>;

  // Hooks
  protected tasksHooks = new Map<string, {
    pre?: { handlers: Function[]; wrapped: PreHookHandlerType<T> };
    post?: { handlers: Function[]; wrapped: PostHookHandlerType<T> };
  }>();

  private wrapTaskHookHandlers(taskName: string, moment: TaskHookMoment, handlers: Function[]) {
    if (moment === 'pre') {
      // 'pre' handlers executions '(a)wait', and if one fails, the task execution is interrupted - throws exception.
      return async (data: Partial<T>, log = this.logger) => {
        try {
          for (let i = 0; i < handlers.length; i++) {
            await handlers[i](data, log);
          }
        } catch (error) {
          log.error(error, `${taskName}: ${moment} hook fail, object ${JSON.stringify(data)}`);
          throw error;
        }
      };
    } else if (moment === 'post') {
      // 'post' handlers executions do not '(a)wait', and if any fails, execution continues with a warning
      return (object: T, log = this.logger) => {
        for (let i = 0; i < handlers.length; i++) {
          try {
            handlers[i](object, log);
          } catch (error) {
            log.warn(error, `${taskName}: ${moment} hook fail, object ${JSON.stringify(object)}`);
          }
        }
      };
    }
  }

  protected setTaskHookHandler(taskName: string, moment: TaskHookMoment, handler: Function) {
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

  protected unsetTaskHookHandler(taskName: string, moment: TaskHookMoment, handler: Function) {
    const handlers = this.tasksHooks.get(taskName)?.[moment]?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);

      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }
}
