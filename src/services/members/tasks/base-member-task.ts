// global
import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { Task } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';

export abstract class BaseMemberTask implements Task<Actor, Member> {
  protected memberService: MemberService;
  protected _status: TaskStatus;
  protected _result: Member | Member[];
  protected _message: string;

  readonly actor: Actor;

  targetId: string;
  data: Partial<Member>;

  constructor(actor: Actor, memberService: MemberService) {
    this.actor = actor;
    this.memberService = memberService;
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

  abstract async run(handler: DatabaseTransactionHandler): Promise<void | BaseMemberTask[]>;
}
