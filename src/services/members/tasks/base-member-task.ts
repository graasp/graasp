// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { Task } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';

export abstract class BaseMemberTask<T extends Actor> implements Task<T, Member> {
  protected memberService: MemberService;
  protected _result: Member | Member[];
  protected _message: string;

  readonly actor: T;

  status: TaskStatus;
  targetId: string;
  data: Partial<Member>;

  constructor(actor: T, memberService: MemberService) {
    this.actor = actor;
    this.memberService = memberService;
    this.status = 'NEW';
  }

  abstract get name(): string;
  get result(): Member | Member[] { return this._result; }
  get message(): string { return this._message; }

  abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseMemberTask<T>[]>;
}
