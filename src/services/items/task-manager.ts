// global
// other services
import { Member } from '../../services/members/interfaces/member';
import { ItemMembershipService } from '../../services/item-memberships/db-service';
import { UnknownExtra } from '../../interfaces/extra';
// local
import { ItemService } from './db-service';
import { Item } from './interfaces/item';
import { GetItemTask } from './tasks/get-item-task';
import { GetItemChildrenTask } from './tasks/get-item-children-task';
import { GetOwnItemsTask } from './tasks/get-own-items-task';
import { GetItemsSharedWithTask } from './tasks/get-items-shared-with-task';
import { CreateItemTask } from './tasks/create-item-task';
import { UpdateItemTask } from './tasks/update-item-task';
import { DeleteItemTask } from './tasks/delete-item-task';
import { MoveItemTask } from './tasks/move-item-task';
import { CopyItemTask } from './tasks/copy-item-task';
import { ItemTaskManager } from './interfaces/item-task-manager';
import {GetGroupItemsTask} from './tasks/get-group-items-task';

export class TaskManager implements ItemTaskManager<Member> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  getCreateTaskName(): string { return CreateItemTask.name; }
  getGetTaskName(): string { return GetItemTask.name; }
  getUpdateTaskName(): string { return UpdateItemTask.name; }
  getDeleteTaskName(): string { return DeleteItemTask.name; }

  getMoveTaskName(): string { return MoveItemTask.name; }
  getCopyTaskName(): string { return CopyItemTask.name; }
  getGetChildrenTaskName(): string { return GetItemChildrenTask.name; }
  getGetOwnTaskName(): string { return GetOwnItemsTask.name; }
  getGetSharedWithTaskName(): string { return GetItemsSharedWithTask.name; }

  // CRUD
  createCreateTask<E extends UnknownExtra>(member: Member, data: Partial<Item<E>>, parentId?: string): CreateItemTask<E> {
    return new CreateItemTask<E>(member, data, this.itemService, this.itemMembershipService, parentId);
  }

  createGetTask<E extends UnknownExtra>(member: Member, itemId: string): GetItemTask<E> {
    return new GetItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createUpdateTask<E extends UnknownExtra>(member: Member, itemId: string, data: Partial<Item<E>>): UpdateItemTask<E> {
    return new UpdateItemTask(member, itemId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemId: string): DeleteItemTask {
    return new DeleteItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  // Other
  createMoveTask(member: Member, itemId: string, parentId?: string): MoveItemTask {
    return new MoveItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createCopyTask(member: Member, itemId: string, parentId?: string): CopyItemTask {
    return new CopyItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createGetChildrenTask(member: Member, itemId: string, ordered?: boolean): GetItemChildrenTask {
    return new GetItemChildrenTask(member, itemId, this.itemService, this.itemMembershipService, ordered);
  }

  createGetGroupItemsTask(member: Member, itemId: string): GetGroupItemsTask {
    return new GetGroupItemsTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createGetOwnTask(member: Member): GetOwnItemsTask {
    return new GetOwnItemsTask(member, this.itemService, this.itemMembershipService);
  }

  createGetSharedWithTask(member: Member): GetItemsSharedWithTask {
    return new GetItemsSharedWithTask(member, this.itemService, this.itemMembershipService);
  }
}
