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
import { TaskStatus } from '../../../interfaces/task';

export class UpdateMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string { return UpdateMemberTask.name; }

  constructor(actor: Actor, memberId: string, data: Partial<Member<E>>, memberService: MemberService) {
    super(actor, memberService);
    this.data = data;
    this.targetId = memberId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    // if the targeted member of the update update is different from the actor making it then fail,
    // unless the flag to skip actor validations is set to 'true'
    if (this.targetId !== this.actor.id && !this.skipActorChecks) {
      throw new CannotModifyOtherMembers(this.targetId);
    }

    const member = await this.memberService.get(this.targetId, handler);

    // prepare changes
    // allow for individual changes in extra's own properties except if 'extra' is {};
    // in that case 'extra' is fully replace by {} (empty object).
    if (this.data.extra && Object.keys(this.data.extra).length > 0) {
      this.data.extra = Object.assign({}, member.extra, this.data.extra);
    }

    this._result = await this.memberService.update(this.targetId, this.data, handler);
    this.status = TaskStatus.OK;
  }
}
