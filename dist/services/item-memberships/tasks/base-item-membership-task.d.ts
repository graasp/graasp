import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembershipTask } from '../interfaces/item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { ItemMembershipService } from '../db-service';
export declare abstract class BaseItemMembershipTask implements ItemMembershipTask {
    protected itemService: ItemService;
    protected itemMembershipService: ItemMembershipService;
    protected _status: TaskStatus;
    protected _result: ItemMembership | ItemMembership[];
    protected _message: string;
    readonly actor: Member;
    targetId: string;
    data: Partial<ItemMembership>;
    itemId?: string;
    constructor(actor: Member, itemService: ItemService, itemMembershipService: ItemMembershipService);
    abstract get name(): string;
    get status(): TaskStatus;
    get result(): ItemMembership | ItemMembership[];
    get message(): string;
    protected failWith(error: GraaspError): void;
    abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseItemMembershipTask[]>;
}
