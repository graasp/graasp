// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

export class CreateMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string { return CreateMemberTask.name; }

  constructor(actor: Actor, data: Partial<Member<E>>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // create member
    const member = await this.memberService.create<Member<E>>(this.data, handler);

    this.status = 'OK';
    this._result = member;
  }
}
