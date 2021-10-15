// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError, UnexpectedError } from '../util/graasp-error';
import { Database, DatabasePoolHandler, DatabaseTransactionHandler } from '../plugins/database';

import { TaskRunner } from '../interfaces/task-runner';
import {
  Task,
  PreHookHandlerType,
  PostHookHandlerType,
  TaskHookHandlerHelpers,
  IndividualResultType,
} from '../interfaces/task';
import { Actor } from '../interfaces/actor';

export class GlobalTaskRunner implements TaskRunner<Actor> {
  private databasePool: DatabasePoolHandler;
  protected logger: FastifyLoggerInstance;
  private getIdIfExists = ({ id }: { id?: string }) => id;

  constructor(database: Database, logger: FastifyLoggerInstance) {
    this.databasePool = database.pool;
    this.logger = logger;
  }

  private handleTaskFinish<T>(
    task: Task<Actor, T>,
    log: FastifyLoggerInstance,
    error?: Record<string, unknown>,
  ) {
    if (error) task.status = 'FAIL';

    const {
      name,
      actor: { id: actorId },
      targetId,
      status,
      message: taskMessage,
      result,
    } = task;

    let message = `${name}: ` + `actor '${actorId}'`;

    if (targetId) message += `, target '${targetId}'`;
    message += `, status '${status}'`;
    if (result) {
      const resultText = Array.isArray(result)
        ? result.map(this.getIdIfExists)
        : this.getIdIfExists(result);
      if (resultText) message += `, result '${resultText}'`;
    }
    if (taskMessage) message += `, message '${taskMessage}'`;

    switch (status) {
      case 'OK':
      case 'DELEGATED':
      case 'RUNNING':
        log.info(message);
        break;
      case 'FAIL':
        log.error(error);
        break;
      default:
        log.warn(message);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isGraaspError(object: any): object is GraaspError {
    return 'origin' in object;
  }

  /**
   * Run task, and any subtasks, in a transaction.
   * Depending on the task, if something goes wrong, the whole task might be canceled/reverted.
   * @param task Task to run
   * @param log Logger instance
   * @param handler Transaction handler to use. If not provided just creates a new one.
   * @returns The task's `result`. If it has subtasks, whatever (task/subtask) result that
   * should represent the "global" result (dependant on task implementation).
   */
  private async runTransactionally<T>(
    task: Task<Actor, T>,
    log: FastifyLoggerInstance,
    handler?: DatabaseTransactionHandler,
  ): Promise<T> {
    if (handler) {
      return this.runWithTransactionHandler(task, handler, log);
    } else {
      return this.databasePool.transaction(async (handler) =>
        this.runWithTransactionHandler(task, handler, log),
      );
    }
  }

  private async runWithTransactionHandler<T>(
    task: Task<Actor, T>,
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<T> {
    let subtasks;

    // set task's hook handlers before execution
    this.injectTaskHooksHandlers(task);

    // run task
    try {
      subtasks = await task.run(handler, log);
      this.handleTaskFinish(task, log);
    } catch (error) {
      this.handleTaskFinish(task, log, error);
      throw error;
    }

    // if there's no subtasks, return task result
    if (!subtasks) return task.result;

    let subtask: Task<Actor, T>;
    let i: number;

    // run subtasks
    if (task.partialSubtasks) {
      // if a subtask fails, stop. finished (sub)tasks are not reverted/rolledback.
      try {
        for (i = 0; i < subtasks.length; i++) {
          subtask = subtasks[i];
          this.injectTaskHooksHandlers(subtask); // set task's hook handlers before execution
          await handler.transaction(async (nestedHandler) => subtask.run(nestedHandler, log));
          this.handleTaskFinish(subtask, log);
        }
      } catch (error) {
        this.handleTaskFinish(subtask, log, error);

        if (i === 0) {
          throw error; // abort anyway if 1st subtask fails
        } else {
          log.error(error);
        }
      }
    } else {
      // if a subtask fails, stop and all is reverted/rolledback.
      try {
        for (i = 0; i < subtasks.length; i++) {
          subtask = subtasks[i];
          this.injectTaskHooksHandlers(subtask); // set task's hook handlers before execution
          await subtask.run(handler, log);
        }
        subtasks.forEach((st) => this.handleTaskFinish(st, log));
      } catch (error) {
        this.handleTaskFinish(subtask, log, error);
        throw error;
      }
    }

    return task.result;
  }

  /**
   * Run given task (transactionally) and return the task's result (or throws error).
   * @param task Task to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  async runSingle<T>(task: Task<Actor, T>, log = this.logger): Promise<T> {
    try {
      return await this.runTransactionally(task, log);
    } catch (error) {
      if (this.isGraaspError(error)) throw error;

      // if not graasp error, log error details and return generic error to client
      log.error(error);
      throw new UnexpectedError();
    }
  }

  /**
   * Run given tasks (one by one, each in a separate transaction),
   * collect results (values or errors), and return an array with everything.
   * @param tasks List of tasks to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  async runMultiple(tasks: Task<Actor, unknown>[], log = this.logger): Promise<unknown[]> {
    const result = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        const taskResult = await this.runTransactionally(task, log);
        if (taskResult) result.push(taskResult);
      } catch (error) {
        if (this.isGraaspError(error)) {
          result.push(error);
        } else {
          // if not graasp error, log error details and keep generic error to client
          log.error(error);
          result.push(new UnexpectedError());
        }
      }
    }
    return result;
  }

  /**
   * Run sequence of tasks in the same transaction and return the result of the last one.
   * @param sequence Sequence of tasks to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  async runSingleSequence(sequence: Task<Actor, unknown>[], log = this.logger): Promise<unknown> {
    const numberOfTasks = sequence.length;

    return this.databasePool
      .transaction(async (handler) => {
        try {
          for (let i = 0; i < numberOfTasks; i++) {
            const t = sequence[i];
            if (t.getInput) Object.assign(t.input, t.getInput());
            if (t.skip) {
              continue;
            } else {
              await this.runTransactionally(t, log, handler);
            }
          }
        } catch (error) {
          if (this.isGraaspError(error)) throw error;

          // if not graasp error, log error details and return generic error to client
          log.error(error);
          throw new UnexpectedError();
        }

        const lastTask = sequence[numberOfTasks - 1];
        return lastTask.getResult?.() ?? lastTask.result;
      });
  }

  /**
   * Run given sequences (one by one, each in a separate transaction),
   * collect results (values or errors), and return an array with everything.
   * @param sequences List of sequences of tasks to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
   async runMultipleSequences(sequences: Task<Actor, unknown>[][], log = this.logger): Promise<unknown[]> {
    const result = [];

    for (let i = 0; i < sequences.length; i++) {
      const sequence = sequences[i];
      try {
        const sequenceResult = await this.runSingleSequence(sequence, log);
        if (sequenceResult) result.push(sequenceResult);
      } catch (error) {
        if (this.isGraaspError(error)) {
          result.push(error);
        } else { // if not graasp error, log error details and keep generic error to client
          log.error(error);
          result.push(new UnexpectedError());
        }
      }
    }
    return result;
  }

  // Hooks
  setTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void {
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

    hooks.pre.handlers.push(handler);
  }

  setTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void {
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

    hooks.post.handlers.push(handler);
  }

  unsetTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void {
    const handlers = this.tasksHooks.get(taskName)?.pre?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);
      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }

  unsetTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void {
    const handlers = this.tasksHooks.get(taskName)?.post?.handlers;

    if (handlers) {
      const handlerIndex = handlers.indexOf(handler);
      if (handlerIndex >= 0) handlers.splice(handlerIndex, 1);
    }
  }

  private tasksHooks = new Map<
    string,
    {
      pre?: { handlers: PreHookHandlerType<unknown>[]; wrapped: PreHookHandlerType<unknown> };
      post?: { handlers: PostHookHandlerType<unknown>[]; wrapped: PostHookHandlerType<unknown> };
    }
  >();

  private injectTaskHooksHandlers<T>(task: Task<Actor, T>) {
    const { name } = task;
    task.preHookHandler = this.tasksHooks.get(name)?.pre?.wrapped;
    task.postHookHandler = this.tasksHooks.get(name)?.post?.wrapped;
  }

  private wrapTaskPreHookHandlers<T>(taskName: string, handlers: PreHookHandlerType<T>[]) {
    // 'pre' handlers executions '(a)wait', and if one fails, the task execution is interrupted - throws exception.
    return async (
      data: Partial<IndividualResultType<T>>,
      actor: Actor,
      { log, handler }: TaskHookHandlerHelpers,
      extraData?: unknown,
    ) => {
      try {
        for (let i = 0; i < handlers.length; i++) {
          await handlers[i](data, actor, { log, handler }, extraData);
        }
      } catch (error) {
        log.error(`${taskName}: pre hook fail, object ${JSON.stringify(data)}`);
        throw error;
      }
    };
  }

  private wrapTaskPostHookHandlers<T>(taskName: string, handlers: PostHookHandlerType<T>[]) {
    // 'post' handlers executions '(a)wait', and if one fails, the task execution is interrupted - throws exception.
    return async (
      data: T,
      actor: Actor,
      { log, handler }: TaskHookHandlerHelpers,
      extraData?: unknown,
    ) => {
      try {
        for (let i = 0; i < handlers.length; i++) {
          await handlers[i](data, actor, { log, handler }, extraData);
        }
      } catch (error) {
        log.error(`${taskName}: post hook fail, object ${JSON.stringify(data)}`);
        throw error;
      }
    };
  }
}
