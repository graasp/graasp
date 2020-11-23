import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
export declare class DeleteItemMembershipSubTask extends BaseItemMembershipTask {
    get name(): string;
    constructor(member: Member, itemMembershipId: string, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
export declare class DeleteItemMembershipTask extends BaseItemMembershipTask {
    get name(): string;
    private purgeBelow;
    constructor(member: Member, itemMembershipId: string, itemService: ItemService, itemMembershipService: ItemMembershipService, purgeBelow?: boolean);
    run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]>;
}
