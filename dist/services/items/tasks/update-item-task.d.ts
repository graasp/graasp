import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
declare class UpdateItemSubTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, data: Partial<Item>, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
export declare class UpdateItemTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, data: Partial<Item>, itemService: ItemService, itemMembershipService: ItemMembershipService);
    private extractPropagatingChanges;
    run(handler: DatabaseTransactionHandler): Promise<UpdateItemSubTask[]>;
}
export {};
