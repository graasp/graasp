// global
import { MemberNotFound } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';
// local
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
import { Member } from '../interfaces/member';

export class GetMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string {
    return GetMemberTask.name;
  }

  constructor(actor: Actor, memberId: string, memberService: MemberService) {
    super(actor, memberService);
    this.targetId = memberId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get member
    const member = await this.memberService.get<E>(this.targetId, handler);
    if (!member) throw new MemberNotFound(this.targetId);

    this.status = 'OK';
    this._result = member;
  }
}
