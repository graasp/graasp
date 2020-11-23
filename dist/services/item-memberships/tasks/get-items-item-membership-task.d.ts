import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
export declare class GetItemsItemMembershipsTask extends BaseItemMembershipTask {
    get name(): string;
    constructor(member: Member, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
