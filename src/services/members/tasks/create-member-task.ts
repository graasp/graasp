// global
import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';
// local
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
import { TaskStatus } from '../../..';

type InputType<E extends UnknownExtra> = { data?: Partial<Member<E>> };

export class CreateMemberTask<E extends UnknownExtra> extends BaseMemberTask<Member<E>> {
  get name(): string {
    return CreateMemberTask.name;
  }

  input: InputType<E>;
  getInput: () => InputType<E>;

  constructor(actor: Actor, memberService: MemberService, input?: InputType<E>) {
    super(actor, memberService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { data } = this.input;

    await this.preHookHandler?.(data, this.actor, { log, handler });

    // create member
    const member = await this.memberService.create<E>(data, handler);
    await this.postHookHandler?.(member, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = member;
  }
}
