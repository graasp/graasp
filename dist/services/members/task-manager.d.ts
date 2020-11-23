import { FastifyLoggerInstance } from 'fastify';
import { Database } from '../../plugins/database';
import { Actor } from '../../interfaces/actor';
import { BaseTaskManager } from '../../services/base-task-manager';
import { Member } from './interfaces/member';
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-member-task';
import { BaseMemberTask } from './tasks/base-member-task';
import { CreateMemberTask } from './tasks/create-member-task';
import { GetMembersByTask } from './tasks/get-members-by-task';
export declare class MemberTaskManager extends BaseTaskManager<Member> {
    private memberService;
    constructor(itemService: MemberService, database: Database, logger: FastifyLoggerInstance);
    createGetTask(actor: Actor, memberId: string): GetMemberTask;
    createGetByTask(actor: Actor, data: Partial<Member>): GetMembersByTask;
    createCreateTask(actor: Actor, data: Partial<Member>): CreateMemberTask;
    createUpdateTask(actor: Actor, objectId: string, object: Partial<Member>): BaseMemberTask;
    createDeleteTask(actor: Actor, objectId: string): BaseMemberTask;
}
