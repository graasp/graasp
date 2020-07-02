// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// other services
import { ItemService } from 'services/items/db-service';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembershipTask } from '../interfaces/item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { ItemMembershipService } from '../db-service';

export abstract class BaseItemMembershipTask implements ItemMembershipTask {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected _status: TaskStatus;
  protected _result: ItemMembership;
  protected _error: string;

  readonly actor: Member;

  targetId: string;
  data: Partial<ItemMembership>;

  itemId: string;

  constructor(actor: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.actor = actor;
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  abstract get name(): string;
  get status() { return this._status; }
  get result() { return this._result; }
  get error() { return this._error; }

  protected failWith(error: GraaspError) {
    this._status = TaskStatus.Fail;
    this._error = error.name;
    throw error;
  }

  abstract async run(handler: DatabaseTransactionHandler): Promise<void | BaseItemMembershipTask[]>;
}
