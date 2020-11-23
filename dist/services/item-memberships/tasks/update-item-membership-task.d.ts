import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';
export declare class UpdateItemMembershipTask extends BaseItemMembershipTask {
    get name(): string;
    constructor(member: Member, itemMembershipId: string, data: Partial<ItemMembership>, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]>;
}
