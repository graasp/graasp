import { Actor, DatabaseTransactionHandler, Member, TaskStatus, UnknownExtra } from '@graasp/sdk';

import { CannotModifyOtherMembers } from '../../../util/graasp-error';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';

type InputType = {
  memberId?: string;
};

export class DeleteMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string {
    return DeleteMemberTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(actor: Actor, memberService: MemberService, input: InputType) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { memberId } = this.input;
    this.targetId = memberId;

    // if the targeted member of the update update is different from the actor making it then fail,
    // unless the flag to skip actor validations is set to 'true'
    if (memberId !== this.actor.id) {
      throw new CannotModifyOtherMembers(memberId);
    }

    this._result = await this.memberService.delete(memberId, handler);
    this.status = TaskStatus.OK;
  }
}
