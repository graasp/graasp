// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
import { Task } from 'interfaces/task';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';

export abstract class BaseMemberTask implements Task<Member, Member> {
  protected memberService: MemberService;
  protected _status: TaskStatus;
  protected _result: Member;
  protected _message: string;

  readonly actor: Member;

  targetId: string;
  data: Partial<Member>;

  constructor(member: Member, memberService: MemberService) {
    this.actor = member;
    this.memberService = memberService;
  }

  abstract get name(): string;
  get status() { return this._status; }
  get result() { return this._result; }
  get message() { return this._message; }

  protected failWith(error: GraaspError) {
    this._status = TaskStatus.Fail;
    this._message = error.name;
    throw error;
  }

  abstract async run(handler: DatabaseTransactionHandler): Promise<void | BaseMemberTask[]>;
}
