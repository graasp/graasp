// global
// other services
import { Member } from '../../services/members/interfaces/member';
import { ItemService } from '../../services/items/db-service';
// local
import { ItemMembershipService } from './db-service';
import { ItemMembership } from './interfaces/item-membership';
import { BaseItemMembershipTask } from './tasks/base-item-membership-task';
import { CreateItemMembershipTask } from './tasks/create-item-membership-task';
import { UpdateItemMembershipTask } from './tasks/update-item-membership-task';
import { DeleteItemMembershipTask } from './tasks/delete-item-membership-task';
import { GetItemsItemMembershipsTask } from './tasks/get-items-item-membership-task';
import { ItemMembershipTaskManager } from './interfaces/item-membership-task-manager';

export class TaskManager implements ItemMembershipTaskManager<Member> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  getCreateTaskName(): string { return CreateItemMembershipTask.name; }
  getGetTaskName(): string { throw new Error('Method not implemented.'); }
  getUpdateTaskName(): string { return UpdateItemMembershipTask.name; }
  getDeleteTaskName(): string { return DeleteItemMembershipTask.name; }

  getGetOfItemTaskName(): string { return GetItemsItemMembershipsTask.name; }

  // CRUD
  createCreateTask(member: Member, data: Partial<ItemMembership>, itemId: string): CreateItemMembershipTask {
    return new CreateItemMembershipTask(member, data, itemId, this.itemService, this.itemMembershipService);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createGetTask(member: Member, objectId: string): BaseItemMembershipTask<ItemMembership> {
    throw new Error('Method not implemented.');
  }

  createUpdateTask(member: Member, itemMembershipId: string, data: Partial<ItemMembership>): UpdateItemMembershipTask {
    return new UpdateItemMembershipTask(member, itemMembershipId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemMembershipId: string, purgeBelow?: boolean): DeleteItemMembershipTask {
    return new DeleteItemMembershipTask(member, itemMembershipId, this.itemService, this.itemMembershipService, purgeBelow);
  }

  // Other
  createGetOfItemTask(member: Member, itemId: string): GetItemsItemMembershipsTask {
    return new GetItemsItemMembershipsTask(member, itemId, this.itemService, this.itemMembershipService);
  }
}
