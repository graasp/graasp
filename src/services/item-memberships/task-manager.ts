// global
import { TaskManager } from '../../interfaces/task-manager';
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

export class ItemMembershipTaskManager implements TaskManager<Member, ItemMembership> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  // CRUD
  createCreateTask(member: Member, data: Partial<ItemMembership>, itemId: string): CreateItemMembershipTask {
    return new CreateItemMembershipTask(member, data, itemId, this.itemService, this.itemMembershipService);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createGetTask(actor: Member, objectId: string): BaseItemMembershipTask {
    throw new Error('Method not implemented.');
  }

  createUpdateTask(member: Member, itemMembershipId: string, data: Partial<ItemMembership>): UpdateItemMembershipTask {
    return new UpdateItemMembershipTask(member, itemMembershipId, data, this.itemService, this.itemMembershipService);
  }

  createDeleteTask(member: Member, itemMembershipId: string, purgeBelow?: boolean): DeleteItemMembershipTask {
    return new DeleteItemMembershipTask(member, itemMembershipId, this.itemService, this.itemMembershipService, purgeBelow);
  }

  // Other
  createGetItemsItemMembershipsTask(actor: Member, itemId: string): GetItemsItemMembershipsTask {
    return new GetItemsItemMembershipsTask(actor, itemId, this.itemService, this.itemMembershipService);
  }
}
