// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

export class GetMembersByTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>[]> {
  get name(): string { return GetMembersByTask.name; }

  constructor(actor: Actor, data: Partial<Member<E>>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get member(s) matching a set of properties
    const members = await this.memberService.getMatching<Member<E>>(this.data, handler);

    this.status = 'OK';
    this._result = members;
  }
}
