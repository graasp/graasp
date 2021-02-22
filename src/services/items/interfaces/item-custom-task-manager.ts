// global
import { TaskManager } from '../../../interfaces/task-manager';
// other
import { Member } from '../../members/interfaces/member';
// local
import { Item } from './item';
import { ItemTask } from './item-task';

export interface ItemCustomTaskManager extends TaskManager<Member, Item> {
  getMoveItemTaskName(): string;
  getCopyItemTaskName(): string;
  getGetItemChildrenTaskName(): string;
  getGetOwnItemsTaskName(): string;
  getGetItemsSharedWithTaskName(): string;

  createMoveItemTask(member: Member, itemId: string, parentId?: string): ItemTask;
  createCopyItemTask(member: Member, itemId: string, parentId?: string): ItemTask;
  createGetItemChildrenTask(member: Member, itemId: string): ItemTask;
  createGetOwnItemsTask(member: Member): ItemTask;
  createGetItemsSharedWithTask(member: Member): ItemTask;
}
