// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from 'util/graasp-error';
import { Database, DatabasePoolHandler } from 'plugins/database';

import { TaskManager } from 'interfaces/task-manager';
import { Task, TaskStatus } from 'interfaces/task';
import { Actor } from 'interfaces/actor';

export abstract class BaseTaskManager<T> implements TaskManager<Actor, T> {
  private databasePool: DatabasePoolHandler;
  protected logger: FastifyLoggerInstance;

  constructor(database: Database, logger: FastifyLoggerInstance) {
    this.databasePool = database.pool;
    this.logger = logger;
  }

  private handleTaskFinish(task: Task<Actor, T>) {
    const { name, actor: { id: actorId }, targetId, status, message: taskMessage } = task;

    let message = `${name}: ` +
      `actor '${actorId}'`;

    if (targetId) message += `, target '${targetId}'`;
    message += `, status '${status}'`;
    if (taskMessage) message += `, message '${taskMessage}'`;

    switch (status) {
      case TaskStatus.OK:
      case TaskStatus.Running: this.logger.info(message); break;
      case TaskStatus.Partial: this.logger.warn(message); break;
      case TaskStatus.Fail: this.logger.error(message); break;
      default: this.logger.debug(message);
    }

    // TODO: push notification to client in case the task signals it.
  }

  /**
   * Run each task, and any subtasks, in a transaction.
   * If something goes wrong the whole task is canceled/reverted.
   *
   * @param task Task to run
   * @returns Task's `result` or, if it has subtasks, the `result` of the last subtask.
   */
  private async runTransactionally(task: Task<Actor, T>): Promise<T | T[]> {
    return this.databasePool.transaction(async (handler) => {
      let taskResult: T | T[];
      let subtasks;

      // run task
      try {
        subtasks = await task.run(handler);
        taskResult = task.result;
        // TODO: should these logger calls, and future pushes to the client,
        // be done in the middle of the transaction logic?
        // Maybe the whole logging should be done afterwards. *1
        this.handleTaskFinish(task);
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(task);
        }
        throw error;
      }

      // if there's no subtasks, "register" the task finishing
      if (!subtasks) return taskResult;

      // run subtasks
      let subtask;

      try {
        for (let i = 0; i < subtasks.length; i++) {
          subtask = subtasks[i];
          await subtask.run(handler);
        }

        subtasks.forEach((st: Task<Actor, T>) => this.handleTaskFinish(st)); // TODO: *1

        // set the last subtask result as the result of the task
        taskResult = subtasks[subtasks.length - 1].result;
      } catch (error) {
        if (error instanceof GraaspError) {
          this.handleTaskFinish(subtask);
        }
        throw error;
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
   */
  async run(tasks: Task<Actor, T>[]): Promise<void | T | T[]> {
    if (tasks.length === 1) {
      return this.runTransactionally(tasks[0]);
    }

    const result = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        const taskResult = await this.runTransactionally(task);
        result.push(taskResult);
      } catch (error) {
        // log unexpected errors and continue
        if (!(error instanceof GraaspError)) {
          this.logger.error(error.message || error); // TODO: improve?
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
}
