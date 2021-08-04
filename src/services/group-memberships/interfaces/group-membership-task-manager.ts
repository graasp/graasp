// local
import { GroupMembership } from './group-membership';
import {Actor} from '../../../interfaces/actor';
import {Task} from '../../../interfaces/task';

export interface GroupMembershipTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;

  createCreateTask(actor: A, object: Partial<GroupMembership>, extra?: unknown): Task<A, GroupMembership>;

  createGetTask(actor: A): Task<A,GroupMembership[]>
}
