// global
import { MemberNotFound } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

export class GetMemberTask extends BaseMemberTask<Actor> {
  get name(): string { return GetMemberTask.name; }

  constructor(actor: Actor, memberId: string, memberService: MemberService) {
    super(actor, memberService);
    this.targetId = memberId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this._status = 'RUNNING';

    // get member
    const member = await this.memberService.get(this.targetId, handler, ['id', 'name']) as Member;
    if (!member) this.failWith(new MemberNotFound(this.targetId));

    this._status = 'OK';
    this._result = member;
  }
}
