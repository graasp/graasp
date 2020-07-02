// global
import { FastifyLoggerInstance } from 'fastify';
import { Database } from 'plugins/database';
// other services
import { Member } from 'services/members/interfaces/member';
import { BaseTaskManager } from 'services/base-task-manager';
// local
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-item-task';
import { BaseMemberTask } from './tasks/base-item-task';

export class MemberTaskManager extends BaseTaskManager<Member> {
  private memberService: MemberService;

  constructor(
    itemService: MemberService,
    database: Database, logger: FastifyLoggerInstance
  ) {
    super(database, logger);
    this.memberService = itemService;
  }

  createGetTask(member: Member, memberId: string) {
    return new GetMemberTask(member, memberId, this.memberService);
  }

  createCreateTask(actor: Member, object: Member, extra?: unknown): BaseMemberTask {
    throw new Error('Method not implemented.');
  }

  createUpdateTask(actor: Member, objectId: string, object: Partial<Member>): BaseMemberTask {
    throw new Error('Method not implemented.');
  }

  createDeleteTask(actor: Member, objectId: string): BaseMemberTask {
    throw new Error('Method not implemented.');
  }
}
