// global
import { Actor } from '../../interfaces/actor';
import { UnknownExtra } from '../../interfaces/extra';
// local
import { Member } from './interfaces/member';
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-member-task';
import { BaseMemberTask } from './tasks/base-member-task';
import { CreateMemberTask } from './tasks/create-member-task';
import { GetMembersByTask } from './tasks/get-members-by-task';
import { MemberTaskManager } from './interfaces/member-task-manager';

export class TaskManager implements MemberTaskManager {
  private memberService: MemberService;

  constructor(memberService: MemberService) {
    this.memberService = memberService;
  }

  getCreateTaskName(): string { return CreateMemberTask.name; }
  getGetTaskName(): string { return GetMemberTask.name; }
  getUpdateTaskName(): string { throw new Error('Method not implemented.'); }
  getDeleteTaskName(): string { throw new Error('Method not implemented.'); }

  getGetByTaskName(): string { return GetMembersByTask.name; }

  // CRUD
  createCreateTask<E extends UnknownExtra>(actor: Actor, data: Partial<Member<E>>): CreateMemberTask<E> {
    return new CreateMemberTask<E>(actor, data, this.memberService);
  }

  createGetTask<E extends UnknownExtra>(actor: Actor, memberId: string): GetMemberTask<E> {
    return new GetMemberTask<E>(actor, memberId, this.memberService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createUpdateTask<E extends UnknownExtra>(actor: Actor, objectId: string, object: Partial<Member<E>>): BaseMemberTask<Member<E>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDeleteTask(actor: Actor, objectId: string): BaseMemberTask<Member> {
    throw new Error('Method not implemented.');
  }

  // Other
  createGetByTask(actor: Actor, data: Partial<Member>): GetMembersByTask {
    return new GetMembersByTask(actor, data, this.memberService);
  }
}
