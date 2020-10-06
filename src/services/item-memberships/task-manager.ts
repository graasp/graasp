// global
import { FastifyLoggerInstance } from 'fastify';
import { Database } from 'plugins/database';
// other services
import { Member } from 'services/members/interfaces/member';
import { ItemService } from 'services/items/db-service';
// local
import { ItemMembershipService } from './db-service';
import { ItemMembership } from './interfaces/item-membership';
import { BaseTaskManager } from 'services/base-task-manager';
import { CreateItemMembershipTask } from './tasks/create-item-membership-task';
import { UpdateItemMembershipTask } from './tasks/update-item-membership-task';
import { DeleteItemMembershipTask } from './tasks/delete-item-membership-task';
import { ItemMembershipTask } from './interfaces/item-membership-task';
import { GetItemsItemMembershipsTask } from './tasks/get-items-item-membership-task';

export class ItemMembershipTaskManager extends BaseTaskManager<ItemMembership> {
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

  createGetTask(actor: Member, objectId: string): ItemMembershipTask {
    throw new Error('Method not implemented.');
  }

  createCreateTask(member: Member, data: Partial<ItemMembership>, itemId: string) {
    return new CreateItemMembershipTask(
      member, data, itemId,
      this.itemService, this.itemMembershipService
    );
  }

  createUpdateTask(member: Member, itemMembershipId: string, data: Partial<ItemMembership>) {
    return new UpdateItemMembershipTask(
      member, itemMembershipId, data,
      this.itemService, this.itemMembershipService
    );
  }

  createDeleteTask(member: Member, itemMembershipId: string, purgeBelow?: boolean): ItemMembershipTask {
    return new DeleteItemMembershipTask(
      member, itemMembershipId,
      this.itemService, this.itemMembershipService,
      purgeBelow
    );
  }

  createGetItemsItemMembershipsTask(actor: Member, itemId: string): ItemMembershipTask {
    return new GetItemsItemMembershipsTask(
      actor, itemId,
      this.itemService, this.itemMembershipService
    );
  }
}
