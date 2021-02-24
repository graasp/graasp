// global
import { Actor } from '../../../interfaces/actor';
import { BaseTask } from '../../base-task';
// local
import { MemberService } from '../db-service';

export abstract class BaseMemberTask<R> extends BaseTask<Actor, R> {
  protected memberService: MemberService;

  constructor(actor: Actor, memberService: MemberService) {
    super(actor);
    this.memberService = memberService;
  }
}
