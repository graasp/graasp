import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../plugins/database';
import { Actor } from './actor';
import { Result } from './result';

export type TaskStatus = 'NEW' | 'RUNNING' | 'OK' | 'FAIL' | 'DELEGATED';

export interface Task<A extends Actor, T extends Result> {
  readonly name: string;
  readonly actor: A;
  targetId?: string;
  data?: Partial<T>;
  status: TaskStatus;
  readonly result: T | T[];
  readonly message: string;
  readonly partialSubtasks?: boolean;
  // notify: boolean; // Should notify task's result
  run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void | Task<A, T>[]>;

  preHookHandler?: PreHookHandlerType<T>;
  postHookHandler?: PostHookHandlerType<T>;
}

export type PreHookHandlerType<T extends Result> = (data: Partial<T>, actor: Actor, log?: FastifyLoggerInstance) => Promise<void> | void;
export type PostHookHandlerType<T extends Result> = (data: T | T[], actor: Actor, log?: FastifyLoggerInstance) => void;
