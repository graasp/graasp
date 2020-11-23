import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
export declare class GetItemsSharedWithTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemService: ItemService, itemMembershipService: ItemMembershipService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
