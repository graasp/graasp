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
  readonly error: string;
  // notify: boolean; // Should notify task's result
  run(handler: DatabaseTransactionHandler): Promise<void | Task<A, R>[]>;
}
