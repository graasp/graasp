import { Item } from '../../..';
import { Actor } from '../../../interfaces/actor';
import { Task } from '../../../interfaces/task';
import { GetOneItemItemMembershipsTask } from '../tasks/get-one-item-item-membership-task';
import { GetMemberItemMembershipOverItemTaskInputType } from '../tasks/get-member-item-membership-over-item-task';
import { ItemMembership } from './item-membership';
import { GetManyItemsItemMembershipsTask } from '../tasks/get-many-items-item-membership-task';
import { CreateItemMembershipTaskInputType } from '../tasks/create-item-membership-task';

export interface ItemMembershipTaskManager<A extends Actor = Actor> {
  getCreateTaskName(): string;
  getGetTaskName(): string;
  getUpdateTaskName(): string;
  getDeleteTaskName(): string;

  getGetOfItemTaskName(): string;
  createGetAdminMembershipTaskSequence(actor: A, itemId: string): Task<A, unknown>[];
  createCreateTask(actor: A, data: Partial<ItemMembership>): Task<A, ItemMembership>;
  createCreateSubTaskSequence(
    actor: A,
    input: CreateItemMembershipTaskInputType,
  ): Task<A, unknown>[];
  createCreateTaskSequence(
    actor: A,
    object: Partial<ItemMembership>,
    extra?: unknown,
  ): Task<A, unknown>[];
  createGetTask(actor: A, objectId: string): Task<A, ItemMembership>;
  createUpdateTaskSequence(
    actor: A,
    objectId: string,
    object: Partial<ItemMembership>,
  ): Task<A, unknown>[];
  createDeleteTaskSequence(actor: A, objectId: string, extra?: unknown): Task<A, unknown>[];
  createGetOfItemTask(member: A, item?: Item): GetOneItemItemMembershipsTask;
  createGetOfManyItemsTask(member: A, items?: Item[]): GetManyItemsItemMembershipsTask;
  createGetOfItemTaskSequence(actor: A, itemId: string): Task<A, unknown>[];
  createDeleteAllOnAndBelowItemTaskSequence(actor: A, itemId: string): Task<A, unknown>[];
  createGetMemberItemMembershipTask(
    actor: A,
    input?: GetMemberItemMembershipOverItemTaskInputType,
  ): Task<A, ItemMembership>;
}
