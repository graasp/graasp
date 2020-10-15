// global
import { FastifyLoggerInstance } from 'fastify';
import { Database } from 'plugins/database';
import { Actor } from 'interfaces/actor';
// other services
import { BaseTaskManager } from 'services/base-task-manager';
// local
import { Member } from './interfaces/member';
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-member-task';
import { BaseMemberTask } from './tasks/base-member-task';
import { CreateMemberTask } from './tasks/create-member-task';
import { GetMembersByTask } from './tasks/get-members-by-task';

export class MemberTaskManager extends BaseTaskManager<Member> {
  private memberService: MemberService;

  constructor(
    itemService: MemberService,
    database: Database, logger: FastifyLoggerInstance
  ) {
    super(database, logger);
    this.memberService = itemService;
  }

  createGetTask(actor: Actor, memberId: string) {
    return new GetMemberTask(actor, memberId, this.memberService);
  }

  createGetByTask(actor: Actor, data: Partial<Member>) {
    return new GetMembersByTask(actor, data, this.memberService);
  }

  createCreateTask(actor: Actor, data: Partial<Member>) {
    return new CreateMemberTask(actor, data, this.memberService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createUpdateTask(actor: Actor, objectId: string, object: Partial<Member>): BaseMemberTask {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDeleteTask(actor: Actor, objectId: string): BaseMemberTask {
    throw new Error('Method not implemented.');
  }
}
