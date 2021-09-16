import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../plugins/database';
import { Actor } from './actor';

export type TaskStatus = 'NEW' | 'RUNNING' | 'OK' | 'FAIL' | 'DELEGATED';

export type IndividualResultType<T> = T extends (infer E)[] ? E : T;

export interface Task<A extends Actor, T> {
  readonly name: string;
  readonly actor: A;
  targetId?: string;
  data?: Partial<IndividualResultType<T>>;
  status: TaskStatus;
  readonly result: T;
  readonly message?: string;
  readonly partialSubtasks?: boolean;
  run(
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ): Promise<void | Task<A, T>[]>;

  preHookHandler?: PreHookHandlerType<T>;
  postHookHandler?: PostHookHandlerType<T>;

  /**
   * Skip `actor` checks (ex.: if it has permissions to execute the task).
   * Sometimes not applicable. Vary from task to task.
   */
  skipActorChecks?: boolean;

  /**
   * Skip target checks (ex.: if the target w/ `targetId` exists)
   * Sometimes not applicable. Vary from task to task.
   * */
  skipTargetChecks?: boolean;
}

export interface TaskHookHandlerHelpers {
  log: FastifyLoggerInstance;
  handler?: DatabaseTransactionHandler;
}

export type PreHookHandlerType<T, K = unknown> = (
  data: Partial<IndividualResultType<T>>,
  actor: Actor,
  helpers: TaskHookHandlerHelpers,
  extraData?: K,
) => Promise<void> | void;

export type PostHookHandlerType<T, K = unknown> = (
  data: T,
  actor: Actor,
  helpers: TaskHookHandlerHelpers,
  extraData?: K,
) => Promise<void> | void;
