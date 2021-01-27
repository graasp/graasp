// global
import { FastifyLoggerInstance } from 'fastify';
import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { Task } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';

export abstract class BaseMemberTask<T extends Actor> implements Task<T, Member> {
  protected memberService: MemberService;
  protected _status: TaskStatus;
  protected _result: Member | Member[];
  protected _message: string;

  readonly actor: T;

  targetId: string;
  data: Partial<Member>;

  constructor(actor: T, memberService: MemberService) {
    this.actor = actor;
    this.memberService = memberService;

    this._status = TaskStatus.New;
  }

  abstract get name(): string;
  get status(): TaskStatus { return this._status; }
  get result(): Member | Member[] { return this._result; }
  get message(): string { return this._message; }

  protected failWith(error: GraaspError): void {
    this._status = TaskStatus.Fail;
    this._message = error.name;
    throw error;
  }

  abstract run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void | BaseMemberTask<T>[]>;
}
