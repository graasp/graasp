import {Actor} from '../../../interfaces/actor';
import {Group} from '../../members/interfaces/member';
import {Task} from '../../../interfaces/task';

export interface GroupTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;

  createCreateTask(actor: A, object: Partial<Group>, extra?: unknown): Task<A, Group>;

  createGetTask(actor: A, extra?: unknown): Task<A, Group>;


}
