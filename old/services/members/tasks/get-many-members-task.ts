import { Actor, DatabaseTransactionHandler, Member, TaskStatus, UnknownExtra } from '@graasp/sdk';

import { MemberNotFound } from '../../../util/graasp-error';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

type InputType = { memberIds?: string[] };

export class GetManyMembersTask<E extends UnknownExtra> extends BaseMemberTask<
  (Member<E> | MemberNotFound)[]
> {
  get name(): string {
    return GetManyMembersTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(actor: Actor, memberService: MemberService, input?: InputType) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { memberIds } = this.input;
    this.targetId = JSON.stringify(memberIds);

    // get members
    this._result = await Promise.all(
      memberIds.map(async (id) => {
        const member = await this.memberService.get<E>(id, handler);
        return member ?? new MemberNotFound(id);
      }),
    );
    this.status = TaskStatus.OK;
  }
}
