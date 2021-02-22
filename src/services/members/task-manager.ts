// global
import { Actor } from '../../interfaces/actor';
// other services
// local
import { Member } from './interfaces/member';
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-member-task';
import { BaseMemberTask } from './tasks/base-member-task';
import { CreateMemberTask } from './tasks/create-member-task';
import { GetMembersByTask } from './tasks/get-members-by-task';
import { MemberCustomTaskManager } from './interfaces/member-custom-task-manager';

export class MemberTaskManager implements MemberCustomTaskManager {
  private memberService: MemberService;

  constructor(memberService: MemberService) {
    this.memberService = memberService;
  }

  getCreateTaskName(): string { return CreateMemberTask.name; }
  getGetTaskName(): string { return GetMemberTask.name; }
  getUpdateTaskName(): string { throw new Error('Method not implemented.'); }
  getDeleteTaskName(): string { throw new Error('Method not implemented.'); }

  getGetMembersByTaskName(): string { return GetMembersByTask.name; }

  // CRUD
  createCreateTask(actor: Actor, data: Partial<Member>): CreateMemberTask {
    return new CreateMemberTask(actor, data, this.memberService);
  }

  createGetTask(actor: Actor, memberId: string): GetMemberTask {
    return new GetMemberTask(actor, memberId, this.memberService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createUpdateTask(actor: Actor, objectId: string, object: Partial<Member>): BaseMemberTask<Actor> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDeleteTask(actor: Actor, objectId: string): BaseMemberTask<Actor> {
    throw new Error('Method not implemented.');
  }

  // Other
  createGetMembersByTask(actor: Actor, data: Partial<Member>): GetMembersByTask {
    return new GetMembersByTask(actor, data, this.memberService);
  }
}
