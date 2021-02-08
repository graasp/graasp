import { TaskManager } from '../../../interfaces/task-manager';
import { Member } from '../../members/interfaces/member';
import { Item } from './item';

export interface ItemCustomTaskManager extends TaskManager<Member, Item> {
  getCopyItemTaskName(): string;
  getMoveItemTaskName(): string;
}
