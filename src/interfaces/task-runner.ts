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
   * Run given tasks
   * @param tasks Tasks to run
   * @param log Logger instance to use during execution
   */
  runSingle<T>(task: Task<A, T>, log?: FastifyLoggerInstance): Promise<T>;
  runMultiple(tasks: Task<A, unknown>[], log?: FastifyLoggerInstance): Promise<unknown[]>;

  setTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void;
  setTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void;
  unsetTaskPreHookHandler<T>(taskName: string, handler: PreHookHandlerType<T>): void;
  unsetTaskPostHookHandler<T>(taskName: string, handler: PostHookHandlerType<T>): void;
}
