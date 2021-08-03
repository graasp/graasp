// global
import { Actor } from '../../../interfaces/actor';
import { UnknownExtra } from '../../../interfaces/extra';
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


  createCreateTask<E extends UnknownExtra>(actor: A, object: Partial<Item<E>>, extra?: unknown): Task<A, Item<E>>;
  createGetTask<E extends UnknownExtra>(actor: A, objectId: string): Task<A, Item<E>>;
  createUpdateTask<E extends UnknownExtra>(actor: A, objectId: string, object: Partial<Item<E>>): Task<A, Item<E>>;
  createDeleteTask(actor: A, objectId: string, extra?: unknown): Task<A, Item>;

  createMoveTask(actor: Actor, itemId: string, parentId?: string): Task<A, Item>;
  createCopyTask(actor: Actor, itemId: string, parentId?: string): Task<A, Item>;
  createGetChildrenTask(actor: Actor, itemId: string, ordered?: boolean): Task<A, Item[]>;
  createGetGroupItemsTask(actor: Actor, itemId: string): Task<A, Item[]>;
  createGetOwnTask(actor: Actor): Task<A, Item[]>;
  createGetSharedWithTask(actor: Actor): Task<A, Item[]>;
}
