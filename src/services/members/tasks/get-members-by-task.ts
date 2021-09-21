// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
import { TaskStatus } from '../../../interfaces/task';

export class GetMembersByTask extends BaseMemberTask<Member[]> {
  get name(): string { return GetMembersByTask.name; }

  constructor(actor: Actor, data: Partial<Member>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    // get member(s) matching a set of properties
    const members = await this.memberService.getMatching(this.data, handler);

    this.status = TaskStatus.OK;
    this._result = members;
  }
}
