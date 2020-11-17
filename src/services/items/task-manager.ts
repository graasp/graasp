// global
import { FastifyLoggerInstance } from 'fastify';
import { Database } from 'plugins/database';
import { PostHookHandlerType, PreHookHandlerType } from 'interfaces/task';
// other services
import { Member } from 'services/members/interfaces/member';
import { ItemMembershipService } from 'services/item-memberships/db-service';
// local
import { ItemService } from './db-service';
import { Item } from './interfaces/item';
import { BaseTaskManager } from 'services/base-task-manager';
import { GetItemTask } from './tasks/get-item-task';
import { GetItemChildrenTask } from './tasks/get-item-children-task';
import { GetOwnItemsTask } from './tasks/get-own-items-task';
import { GetItemsSharedWithTask } from './tasks/get-items-shared-with-task';
import { CreateItemTask } from './tasks/create-item-task';
import { UpdateItemTask } from './tasks/update-item-task';
import { DeleteItemTask } from './tasks/delete-item-task';
import { MoveItemTask } from './tasks/move-item-task';
import { CopyItemTask } from './tasks/copy-item-task';

export class ItemTaskManager extends BaseTaskManager<Item> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    database: Database, logger: FastifyLoggerInstance
  ) {
    super(database, logger);
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  setPreCopyHandler(handler: PreHookHandlerType<Item>): void {
    this.setTaskPreHookHandler(CopyItemTask.name, handler);
  }

  unsetPreCopyHandler(handler: PreHookHandlerType<Item>): void {
    this.unsetTaskPreHookHandler(CopyItemTask.name, handler);
  }

  setPostDeleteHandler(handler: PostHookHandlerType<Item>): void {
    this.setTaskPostHookHandler(DeleteItemTask.name, handler);
  }

  unsetPostDeleteHandler(handler: PostHookHandlerType<Item>): void {
    this.unsetTaskPostHookHandler(DeleteItemTask.name, handler);
  }

  // Tasks
  createGetTask(member: Member, itemId: string): GetItemTask {
    return new GetItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createGetChildrenTask(member: Member, itemId: string): GetItemChildrenTask {
    return new GetItemChildrenTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createGetOwnTask(member: Member): GetOwnItemsTask {
    return new GetOwnItemsTask(member, this.itemService, this.itemMembershipService);
  }

  createGetSharedWithTask(member: Member): GetItemsSharedWithTask {
    return new GetItemsSharedWithTask(member, this.itemService, this.itemMembershipService);
  }

  createCreateTask(member: Member, data: Partial<Item>, parentId?: string): CreateItemTask {
    return new CreateItemTask(member, data, this.itemService, this.itemMembershipService, parentId);
  }

  createUpdateTask(member: Member, itemId: string, data: Partial<Item>): UpdateItemTask {
    return new UpdateItemTask(member, itemId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemId: string): DeleteItemTask {
    const postHookHandler = this.tasksHooks.get(DeleteItemTask.name)?.post?.wrapped;
    return new DeleteItemTask(member, itemId, this.itemService, this.itemMembershipService, postHookHandler);
  }

  createMoveTask(member: Member, itemId: string, parentId?: string): MoveItemTask {
    return new MoveItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createCopyTask(member: Member, itemId: string, parentId?: string): CopyItemTask {
    const preHookHandler = this.tasksHooks.get(CopyItemTask.name)?.pre?.wrapped;
    return new CopyItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId, preHookHandler);
  }
}
