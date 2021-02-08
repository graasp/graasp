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
  run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void | Task<A, T>[]>;

  preHookHandler?: PreHookHandlerType<T>;
  postHookHandler?: PostHookHandlerType<T>;
}

export interface TaskHookHandlerHelpers {
  log: FastifyLoggerInstance, handler?: DatabaseTransactionHandler
}

export type PreHookHandlerType<T extends Result, K = unknown> =
  (data: T | Partial<T>, actor: Actor, helpers: TaskHookHandlerHelpers, extraData?: K) => Promise<void> | void;

export type PostHookHandlerType<T extends Result, K = unknown> =
  (data: T | T[], actor: Actor, helpers: TaskHookHandlerHelpers, extraData?: K) => Promise<void> | void;
