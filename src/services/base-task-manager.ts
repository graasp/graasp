// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from 'util/graasp-error';
import { Database, DatabasePoolHandler } from 'plugins/database';

import { TaskManager } from 'interfaces/task-manager';
import { Task, TaskStatus } from 'interfaces/task';
import { Member } from './members/interfaces/member';

export abstract class BaseTaskManager<T> implements TaskManager<Member, T> {
  private databasePool: DatabasePoolHandler;
  private logger: FastifyLoggerInstance;

  constructor(database: Database, logger: FastifyLoggerInstance) {
    this.databasePool = database.pool;
    this.logger = logger;
  }

  private handleTaskFinish(task: Task<Member, T>) {
    const { name, actor: { id: actorId }, targetId: targetId, status, error } = task;

    let message = `${name}: ` +
      `actor '${actorId}'`;

    if (targetId) message += `, target '${targetId}'`;
    message += `, status '${status}'`;
    if (error) message += `, error '${error}'`;

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
  private async runTransactionally(task: Task<Member, T>): Promise<T> {
    return this.databasePool.transaction(async (handler) => {
      let taskResult: T;
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

        subtasks.forEach((st: Task<Member, T>) => this.handleTaskFinish(st)); // TODO: *1

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
  async run(tasks: Task<Member, T>[]): Promise<void | T | T[]> {
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

  abstract createCreateTask(actor: Member, object: T, extra?: unknown): Task<Member, T>;
  abstract createGetTask(actor: Member, objectId: string): Task<Member, T>;
  abstract createUpdateTask(actor: Member, objectId: string, object: Partial<T>): Task<Member, T>;
  abstract createDeleteTask(actor: Member, objectId: string): Task<Member, T>;
}
