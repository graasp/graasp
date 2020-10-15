// global
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
import { Actor } from 'interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

export class GetMembersByTask extends BaseMemberTask {
  get name() { return GetMembersByTask.name; }

  constructor(actor: Actor, data: Partial<Member>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get member(s) by a set of properties
    const members = await this.memberService.getMatching(this.data, handler) as Member[];

    this._status = TaskStatus.OK;
    this._result = members;
  }
}
