// global
import { Actor } from '../../../interfaces/actor';
import { Task } from '../../../interfaces/task';
// local
import { Item } from './item';

export interface ItemTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;
  getGetTaskName(): string;
  getUpdateTaskName(): string;
  getDeleteTaskName(): string;

  getMoveTaskName(): string;
  getCopyTaskName(): string;
  getGetChildrenTaskName(): string;
  getGetOwnTaskName(): string;
  getGetSharedWithTaskName(): string;

  createCreateTaskSequence(actor: A, object: Partial<Item>, extra?: unknown): Task<A, unknown>[];
  createGetTaskSequence(actor: A, objectId: string): Task<Actor, unknown>[];
  createUpdateTaskSequence(actor: A, objectId: string, object: Partial<Item>): Task<A, unknown>[];
  createDeleteTask(actor: A, item?: Item): Task<A, unknown>;
  createDeleteTaskSequence(actor: A, objectId: string, extra?: unknown): Task<A, unknown>[];

  createMoveTaskSequence(actor: Actor, itemId: string, parentId?: string): Task<A, unknown>[];
  createCopyTaskSequence(actor: Actor, itemId: string, parentId?: string): Task<A, unknown>[];
  createCopySubTaskSequence(actor: Actor, itemTask: Task<A, Item>, parentId?: string): Task<A, unknown>[];
  createGetChildrenTaskSequence(actor: Actor, itemId: string, ordered?: boolean): Task<A, unknown>[];
  createGetOwnTask(actor: Actor): Task<A, Item[]>;
  createGetSharedWithTask(actor: Actor): Task<A, Item[]>;
}
