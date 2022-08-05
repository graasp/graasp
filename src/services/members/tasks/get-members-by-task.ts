import { Actor, DatabaseTransactionHandler, Member, TaskStatus } from '@graasp/sdk';

import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

type InputType = { data?: Partial<Member> };

export class GetMembersByTask extends BaseMemberTask<Member[]> {
  get name(): string {
    return GetMembersByTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(actor: Actor, memberService: MemberService, input?: InputType) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { data } = this.input;

    // get member(s) matching a set of properties
    const members = await this.memberService.getMatching(data, handler);

    this.status = TaskStatus.OK;
    this._result = members;
  }
}
