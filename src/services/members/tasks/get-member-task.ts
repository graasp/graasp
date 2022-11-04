import { Actor, DatabaseTransactionHandler, Member, TaskStatus, UnknownExtra } from '@graasp/sdk';

import { MemberNotFound } from '../../../util/graasp-error';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

type InputType = { memberId?: string };

export class GetMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string {
    return GetMemberTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(actor: Actor, memberService: MemberService, input?: InputType) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { memberId } = this.input;
    this.targetId = memberId;

    // get member
    const member = await this.memberService.get<E>(memberId, handler);
    if (!member) throw new MemberNotFound(memberId);

    this.status = TaskStatus.OK;
    this._result = member;
  }
}
