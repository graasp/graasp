// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-item-task';

export class GetMemberTask extends BaseMemberTask {
  get name() { return GetMemberTask.name; }

  constructor(member: Member, memberId: string, memberService: MemberService) {
    super(member, memberService);
    this.targetId = memberId;
  }

  async run(handler: DatabaseTransactionHandler) {
    this._status = TaskStatus.Running;

    // get member
    const member = await this.memberService.get(this.targetId, handler, ['id', 'name']);
    if (!member) this.failWith(new GraaspError(GraaspError.MemberNotFound, this.targetId));

    this._status = TaskStatus.OK;
    this._result = member;
  }
}
