import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { PostHookHandlerType } from '../../../interfaces/task';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
declare class DeleteItemSubTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService, postHookHandler?: PostHookHandlerType<Item>);
    run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void>;
}
export declare class DeleteItemTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService, postHookHandler?: PostHookHandlerType<Item>);
    run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<DeleteItemSubTask[]>;
}
export {};
