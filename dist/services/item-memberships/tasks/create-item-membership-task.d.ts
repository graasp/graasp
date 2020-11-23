import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask } from './delete-item-membership-task';
export declare class CreateItemMembershipTask extends BaseItemMembershipTask {
    get name(): string;
    constructor(member: Member, data: Partial<ItemMembership>, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]>;
}
