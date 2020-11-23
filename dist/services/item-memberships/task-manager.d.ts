import { FastifyLoggerInstance } from 'fastify';
import { Database } from '../../plugins/database';
import { Member } from '../../services/members/interfaces/member';
import { ItemService } from '../../services/items/db-service';
import { BaseTaskManager } from '../../services/base-task-manager';
import { ItemMembershipService } from './db-service';
import { ItemMembership } from './interfaces/item-membership';
import { CreateItemMembershipTask } from './tasks/create-item-membership-task';
import { UpdateItemMembershipTask } from './tasks/update-item-membership-task';
import { DeleteItemMembershipTask } from './tasks/delete-item-membership-task';
import { ItemMembershipTask } from './interfaces/item-membership-task';
import { GetItemsItemMembershipsTask } from './tasks/get-items-item-membership-task';
export declare class ItemMembershipTaskManager extends BaseTaskManager<ItemMembership> {
    private itemService;
    private itemMembershipService;
    constructor(itemService: ItemService, itemMembershipService: ItemMembershipService, database: Database, logger: FastifyLoggerInstance);
    createGetTask(actor: Member, objectId: string): ItemMembershipTask;
    createCreateTask(member: Member, data: Partial<ItemMembership>, itemId: string): CreateItemMembershipTask;
    createUpdateTask(member: Member, itemMembershipId: string, data: Partial<ItemMembership>): UpdateItemMembershipTask;
    createDeleteTask(member: Member, itemMembershipId: string, purgeBelow?: boolean): DeleteItemMembershipTask;
    createGetItemsItemMembershipsTask(actor: Member, itemId: string): GetItemsItemMembershipsTask;
}
