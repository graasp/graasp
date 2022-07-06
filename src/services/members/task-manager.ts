// global
import { Actor } from '../../interfaces/actor';
import { UnknownExtra } from '../../interfaces/extra';
import { Task } from '../../interfaces/task';
// local
import { Member } from './interfaces/member';
import { MemberService } from './db-service';
import { GetMemberTask } from './tasks/get-member-task';
import { CreateMemberTask } from './tasks/create-member-task';
import { GetMembersByTask } from './tasks/get-members-by-task';
import { MemberTaskManager } from './interfaces/member-task-manager';
import { UpdateMemberTask } from './tasks/update-member-task';
import { GetManyMembersTask } from './tasks/get-many-members-task';
import { DeleteMemberTask } from './tasks/delete-member-task';

export class TaskManager implements MemberTaskManager {
  private memberService: MemberService;

  constructor(memberService: MemberService) {
    this.memberService = memberService;
  }

  // CRUD
  getCreateTaskName(): string {
    return CreateMemberTask.name;
  }
  getGetTaskName(): string {
    return GetMemberTask.name;
  }
  getUpdateTaskName(): string {
    return UpdateMemberTask.name;
  }
  getDeleteTaskName(): string {
    return DeleteMemberTask.name;
  }

  // Other
  getGetByTaskName(): string {
    return GetMembersByTask.name;
  }

  // CRUD
  createCreateTask<E extends UnknownExtra>(
    actor: Actor,
    data: Partial<Member<E>>,
  ): CreateMemberTask<E> {
    return new CreateMemberTask<E>(actor, this.memberService, { data });
  }

  createGetTask<E extends UnknownExtra>(actor: Actor, memberId: string): GetMemberTask<E> {
    return new GetMemberTask<E>(actor, this.memberService, { memberId });
  }

  createGetManyTask<E extends UnknownExtra>(
    actor: Actor,
    memberIds?: string[],
  ): GetManyMembersTask<E> {
    return new GetManyMembersTask<E>(actor, this.memberService, { memberIds });
  }

  createUpdateTaskSequence<E extends UnknownExtra>(
    actor: Actor,
    memberId: string,
    data: Partial<Member<E>>,
  ): Task<Actor, unknown>[] {
    const t1 = new GetMemberTask(actor, this.memberService, { memberId });

    const t2 = new UpdateMemberTask<E>(actor, this.memberService, {
      data,
      actorShouldMatchTarget: true,
    });
    t2.getInput = () => ({ member: t1.result });

    return [t1, t2];
  }

  createDeleteTaskSequence(actor: Actor, memberId: string): Task<Actor, unknown>[] {
    const t1 = new GetMemberTask(actor, this.memberService, { memberId });

    const t2 = new DeleteMemberTask(actor, this.memberService, {
      memberId,
    });

    return [t1, t2];
  }

  createDeleteTask<E extends UnknownExtra>(actor: Actor, memberId: string): Task<Actor, Member<E>> {
    return new DeleteMemberTask(actor, this.memberService, { memberId });
  }

  // Other
  createGetByTask(actor: Actor, data: Partial<Member>): GetMembersByTask {
    return new GetMembersByTask(actor, this.memberService, { data });
  }
}
