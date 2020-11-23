import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
export declare class CreateItemTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, data: Partial<Item>, itemService: ItemService, itemMembershipService: ItemMembershipService, parentItemId?: string);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
