// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { IndividualResultType, TaskStatus } from '../../../interfaces/task';
import { Task } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// local
import { MemberService } from '../db-service';

export abstract class BaseMemberTask<R> implements Task<Actor, R> {
  protected memberService: MemberService;
  protected _result: R;
  protected _message: string;

  readonly actor: Actor;

  data: Partial<IndividualResultType<R>>;
  status: TaskStatus;
  targetId: string;

  constructor(actor: Actor, memberService: MemberService) {
    this.actor = actor;
    this.memberService = memberService;
    this.status = 'NEW';
  }

  abstract get name(): string;
  get result(): R { return this._result; }
  get message(): string { return this._message; }

  abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseMemberTask<R>[]>;
}
