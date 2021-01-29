import { Actor } from './actor';
import { Result } from './result';
import { Task } from './task';

export interface TaskManager<A extends Actor, R extends Result> {
  getCreateTaskName(): string;
  getGetTaskName(): string;
  getUpdateTaskName(): string;
  getDeleteTaskName(): string;

  createCreateTask(actor: A, object: Partial<R>, extra?: unknown): Task<A, R>;
  createGetTask(actor: A, objectId: string): Task<A, R>;
  createUpdateTask(actor: A, objectId: string, object: Partial<R>): Task<A, R>;
  createDeleteTask(actor: A, objectId: string, extra?: unknown): Task<A, R>;
}
