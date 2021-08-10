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

  getGetOfItemTaskName(): string;

  createCreateTask(actor: A, data: Partial<ItemMembership>): Task<A, ItemMembership>;
  createCreateTaskSequence(actor: A, object: Partial<ItemMembership>, extra?: unknown): Task<A, unknown>[];
  createGetTask(actor: A, objectId: string): Task<A, ItemMembership>;
  createUpdateTaskSequence(actor: A, objectId: string, object: Partial<ItemMembership>): Task<A, unknown>[];
  createDeleteTaskSequence(actor: A, objectId: string, extra?: unknown): Task<A, unknown>[];

  createGetOfItemTaskSequence(actor: A, itemId: string): Task<A, unknown>[];
  createDeleteAllOnAndBelowItemTaskSequence(actor: A, itemId: string): Task<A, unknown>[];
  createGetMemberItemMembershipTask(actor: A):  Task<A, ItemMembership>;
}
