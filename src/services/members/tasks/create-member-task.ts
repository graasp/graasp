// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

export class CreateMemberTask extends BaseMemberTask {
  get name(): string { return CreateMemberTask.name; }

  constructor(actor: Actor, data: Partial<Member>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this._status = TaskStatus.Running;

    // create member
    const member = await this.memberService.create(this.data, handler);

    this._status = TaskStatus.OK;
    this._result = member;
  }
}
