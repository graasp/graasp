// global
import { Actor } from '../../../interfaces/actor';
import { Task } from '../../../interfaces/task';
import { UnknownExtra } from '../../../interfaces/extra';
// local
import { Member } from './member';

export interface MemberTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;
  getGetTaskName(): string;
  getUpdateTaskName(): string;
  getDeleteTaskName(): string;

  getGetByTaskName(): string;

  createCreateTask<E extends UnknownExtra>(
    actor: A,
    object: Partial<Member<E>>,
    extra?: unknown,
  ): Task<A, Member<E>>;
  createGetTask<E extends UnknownExtra>(actor: A, objectId: string): Task<A, Member<E>>;
  createUpdateTaskSequence<E extends UnknownExtra>(actor: A, objectId: string, object: Partial<Member<E>>): Task<A, unknown>[];
  createDeleteTask<E extends UnknownExtra>(actor: A, objectId: string, extra?: unknown): Task<A, Member<E>>;

  createGetByTask(actor: A, data: Partial<Member>): Task<A, Member[]>;
}
