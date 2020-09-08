import { DatabaseTransactionHandler } from 'plugins/database';

export enum TaskStatus {
  Running = 'RUNNING',
  OK = 'OK',
  Fail = 'FAIL',
  Partial = 'PARTIAL' // no 100% OK, but acceptable
}

export interface Task<A, T> {
  readonly name: string;
  readonly actor: A;
  targetId?: string;
  data?: Partial<T>;
  readonly status: TaskStatus;
  readonly result: T | T[];
  readonly message: string;
  // notify: boolean; // Should notify task's result
  run(handler: DatabaseTransactionHandler): Promise<void | Task<A, T>[]>;

  preHookHandler?: PreHookHandlerType<T>;
  postHookHandler?: PostHookHandlerType<T>;
}

export type TaskHookMoment = 'pre' | 'post';

export type PreHookHandlerType<T> = (data?: Partial<T>) => Promise<void> | void;
export type PostHookHandlerType<T> = (data?: T | T[]) => void;
