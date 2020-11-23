import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { PreHookHandlerType } from '../../../interfaces/task';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
declare class CopyItemSubTask extends BaseItemTask {
    get name(): string;
    private createMembership;
    constructor(member: Member, itemId: string, data: Partial<Item>, itemService: ItemService, itemMembershipService: ItemMembershipService, createMembership?: boolean, preHookHandler?: PreHookHandlerType<Item>);
    run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void>;
}
export declare class CopyItemTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService, parentItemId?: string, preHookHandler?: PreHookHandlerType<Item>);
    run(handler: DatabaseTransactionHandler): Promise<CopyItemSubTask[]>;
    /**
     * Copy whole tree with new paths and same member as creator
     * @param tree Item and all descendants to copy
     * @param parentItem Parent item whose path will 'prefix' all paths
     */
    private copy;
}
export {};
