// global
import { TaskManager } from '../../../interfaces/task-manager';
import { Actor } from '../../../interfaces/actor';
// other
import { Member } from './member';
// local
import { Task } from '../../../interfaces/task';

export interface MemberCustomTaskManager extends TaskManager<Actor, Member> {
  getGetMembersByTaskName(): string;

  createGetMembersByTask(actor: Actor, data: Partial<Member>): Task<Actor, Member>;
}
