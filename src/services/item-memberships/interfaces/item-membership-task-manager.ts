// global
import { Actor } from '../../../interfaces/actor';
import { Task } from '../../../interfaces/task';
// local
import { ItemMembership } from './item-membership';

export interface ItemMembershipTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;
  getGetTaskName(): string;
  getUpdateTaskName(): string;
  getDeleteTaskName(): string;

  getGetOfItemTaskName(): string


  createCreateTask(actor: A, object: Partial<ItemMembership>, extra?: unknown): Task<A, ItemMembership>;
  createGetTask(actor: A, objectId: string): Task<A, ItemMembership>;
  createUpdateTask(actor: A, objectId: string, object: Partial<ItemMembership>): Task<A, ItemMembership>;
  createDeleteTask(actor: A, objectId: string, extra?: unknown): Task<A, ItemMembership>;

  createGetOfItemTask(actor: A, itemId: string): Task<A, ItemMembership[]>;
  createDeleteAllOfItemTask(actor: A, itemId: string): Task<A, ItemMembership>;
}
