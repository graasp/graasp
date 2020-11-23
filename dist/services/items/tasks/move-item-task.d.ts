import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
export declare class MoveItemTask extends BaseItemTask {
    get name(): string;
    constructor(member: Member, itemId: string, itemService: ItemService, itemMembershipService: ItemMembershipService, parentItemId?: string);
    run(handler: DatabaseTransactionHandler): Promise<void>;
    /**
     * Does the work of moving the item and the necessary changes to all the item memberships
     * involved.
     *
     * `this.itemMembershipService.moveHousekeeping()` runs first because membership paths
     * are *automatically* updated (`ON UPDATE CASCADE`) with `this.itemService.move()` and the
     * "adjustments" need to be calculated before - considering the origin membership paths.
     *
     * * `inserts`' `itemPath`s already have the expected paths for the destination;
     * * `deletes`' `itemPath`s have the path changes after `this.itemService.move()`.
     */
    private moveItem;
}
