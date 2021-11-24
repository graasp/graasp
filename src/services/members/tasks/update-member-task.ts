// global
import { CannotModifyOtherMembers } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { UnknownExtra } from '../../../interfaces/extra';
import { Actor } from '../../../interfaces/actor';
// other services
// local
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
import { Member } from '../interfaces/member';

type InputType<E extends UnknownExtra> = {
  member?: Member;
  data?: Partial<Member<E>>;
  actorShouldMatchTarget?: boolean;
};

export class UpdateMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string {
    return UpdateMemberTask.name;
  }

  input: InputType<E>;
  getInput: () => InputType<E>;

  constructor(actor: Actor, memberService: MemberService, input?: InputType<E>) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    const { member, data, actorShouldMatchTarget } = this.input;
    this.targetId = member.id;

    // if the targeted member of the update update is different from the actor making it then fail,
    // unless the flag to skip actor validations is set to 'true'
    if (actorShouldMatchTarget && member.id !== this.actor.id) {
      throw new CannotModifyOtherMembers(member.id);
    }

    // prepare changes
    // allow for individual changes in extra's own properties except if 'extra' is {};
    // in that case 'extra' is fully replace by {} (empty object).
    if (data.extra && Object.keys(data.extra).length > 0) {
      data.extra = Object.assign({}, member.extra, data.extra);
    }

    this._result = await this.memberService.update(member.id, data, handler);
    this.status = 'OK';
  }
}
