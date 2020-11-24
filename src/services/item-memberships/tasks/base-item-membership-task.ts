// global
import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipTask } from '../interfaces/item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { ItemMembershipService } from '../db-service';

export abstract class BaseItemMembershipTask implements ItemMembershipTask {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected _status: TaskStatus;
  protected _result: ItemMembership | ItemMembership[];
  protected _message: string;

  readonly actor: Member;

  targetId: string;
  data: Partial<ItemMembership>;

  itemId?: string;

  constructor(actor: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.actor = actor;
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  abstract get name(): string;
  get status(): TaskStatus { return this._status; }
  get result(): ItemMembership | ItemMembership[] { return this._result; }
  get message(): string { return this._message; }

  protected failWith(error: GraaspError): void {
    this._status = TaskStatus.Fail;
    this._message = error.name;
    throw error;
  }

  abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseItemMembershipTask[]>;
}
