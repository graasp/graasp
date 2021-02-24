// global
import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../plugins/database';
import { IndividualResultType, PostHookHandlerType, PreHookHandlerType, TaskStatus } from '../interfaces/task';
import { Task } from '../interfaces/task';
import { Actor } from '../interfaces/actor';

export abstract class BaseTask<A extends Actor, R> implements Task<A, R> {
  protected _result: R;
  protected _message: string;

  readonly actor: A;
  protected _partialSubtasks: boolean;

  status: TaskStatus;
  targetId: string;
  data: Partial<IndividualResultType<R>>;
  preHookHandler?: PreHookHandlerType<R>;
  postHookHandler?: PostHookHandlerType<R>;

  constructor(actor: A) {
    this.actor = actor;
    this.status = 'NEW';
  }

  abstract get name(): string;
  get result(): R { return this._result; }
  get message(): string { return this._message; }
  get partialSubtasks(): boolean { return this._partialSubtasks; }

  abstract run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void | BaseTask<A, R>[]>;
}
