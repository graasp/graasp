// global
// other services
import { Member } from '../../services/members/interfaces/member';
import { ItemMembershipService } from '../../services/item-memberships/db-service';
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
import { ItemCustomTaskManager } from './interfaces/item-custom-task-manager';

export class ItemTaskManager implements ItemCustomTaskManager {
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

  getMoveItemTaskName(): string { return MoveItemTask.name; }
  getCopyItemTaskName(): string { return CopyItemTask.name; }
  getGetItemChildrenTaskName(): string { return GetItemChildrenTask.name; }
  getGetOwnItemsTaskName(): string { return GetOwnItemsTask.name; }
  getGetItemsSharedWithTaskName(): string { return GetItemsSharedWithTask.name; }

  // CRUD
  createCreateTask(member: Member, data: Partial<Item>, parentId?: string): CreateItemTask {
    return new CreateItemTask(member, data, this.itemService, this.itemMembershipService, parentId);
  }

  createGetTask(member: Member, itemId: string): GetItemTask {
    return new GetItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createUpdateTask(member: Member, itemId: string, data: Partial<Item>): UpdateItemTask {
    return new UpdateItemTask(member, itemId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemId: string): DeleteItemTask {
    return new DeleteItemTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  // Other
  createMoveItemTask(member: Member, itemId: string, parentId?: string): MoveItemTask {
    return new MoveItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createCopyItemTask(member: Member, itemId: string, parentId?: string): CopyItemTask {
    return new CopyItemTask(member, itemId, this.itemService, this.itemMembershipService, parentId);
  }

  createGetItemChildrenTask(member: Member, itemId: string): GetItemChildrenTask {
    return new GetItemChildrenTask(member, itemId, this.itemService, this.itemMembershipService);
  }

  createGetOwnItemsTask(member: Member): GetOwnItemsTask {
    return new GetOwnItemsTask(member, this.itemService, this.itemMembershipService);
  }

  createGetItemsSharedWithTask(member: Member): GetItemsSharedWithTask {
    return new GetItemsSharedWithTask(member, this.itemService, this.itemMembershipService);
  }
}
