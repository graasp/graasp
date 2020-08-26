import { DatabaseTransactionHandler } from 'plugins/database';

export enum TaskStatus {
  Running = 'RUNNING',
  OK = 'OK',
  Fail = 'FAIL',
  Partial = 'PARTIAL' // no 100% OK, but acceptable
}

export interface Task<A, R> {
  readonly name: string;
  readonly actor: A;
  targetId?: string;
  data?: Partial<R>;
  readonly status: TaskStatus;
  readonly result: R;
  readonly message: string;
  // notify: boolean; // Should notify task's result
  run(handler: DatabaseTransactionHandler): Promise<void | Task<A, R>[]>;

  preHookHandler?: PreHookHandlerType<R>;
  postHookHandler?: PostHookHandlerType<R>;
}

export type TaskHookMoment = 'pre' | 'post';

export type PreHookHandlerType<R> = (data?: Partial<R>) => Promise<void> | void;
export type PostHookHandlerType<R> = (data?: R) => void;
