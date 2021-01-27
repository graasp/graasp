import { FastifyLoggerInstance } from 'fastify';
import { Actor } from './actor';
import { Result } from './result';
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
  run<R extends Result>(tasks: Task<A, R>[], log?: FastifyLoggerInstance): Promise<void | R | R[]>;

  setTaskPreHookHandler<R extends Result>(taskName: string, handler: PreHookHandlerType<R>): void;
  setTaskPostHookHandler<R extends Result>(taskName: string, handler: PostHookHandlerType<R>): void;
  unsetTaskPreHookHandler<R extends Result>(taskName: string, handler: PreHookHandlerType<R>): void;
  unsetTaskPostHookHandler<R extends Result>(taskName: string, handler: PostHookHandlerType<R>): void;
}
