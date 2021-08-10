import { FastifyLoggerInstance } from 'fastify';
import { Actor } from './actor';
import { PostHookHandlerType, PreHookHandlerType, Task } from './task';

declare module 'fastify' {
  interface FastifyInstance {
    taskRunner: TaskRunner<Actor>;
  }
}

export interface TaskRunner<A extends Actor> {
  /**
   * Run given task (transactionally) and return the task's result (or throws error).
   * @param task Task to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  runSingle<T>(task: Task<A, T>, log?: FastifyLoggerInstance): Promise<T>;
  /**
   * Run given tasks (one by one, each in a separate transaction),
   * collect results (values or errors), and return an array with everything.
   * @param tasks List of tasks to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  runMultiple(tasks: Task<A, unknown>[], log?: FastifyLoggerInstance): Promise<unknown[]>;

  /**
   * Run given task sequence in a single transaction, sequencially,
   * and return the last task's result.
   * @param tasks Task sequence to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  runSingleSequence(tasks: Task<A, unknown>[], log?: FastifyLoggerInstance): Promise<unknown>;

  /**
   * Run given tasks sequences (one by one, each in a separate transaction),
   * collect results (values or errors), and return an array with everything.
   * @param tasks List of task sequences to run.
   * @param log Logger instance to use. Defaults to `this.logger`.
   */
  runMultipleSequences(tasks: Task<A, unknown>[][], log?: FastifyLoggerInstance): Promise<unknown>;

  setTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void;
  setTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void;
  unsetTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void;
  unsetTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void;
}
