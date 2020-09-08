// global
import { GraaspError } from 'util/graasp-error';
import { DatabaseTransactionHandler } from 'plugins/database';
import { TaskStatus } from 'interfaces/task';
// other services
import { ItemMembershipService } from 'services/item-memberships/db-service';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemTask } from '../interfaces/item-task';
import { Item } from '../interfaces/item';
import { ItemService } from '../db-service';

export abstract class BaseItemTask implements ItemTask {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected _status: TaskStatus;
  protected _result: Item;
  protected _message: string;

  readonly actor: Member;

  targetId: string;
  data: Partial<Item>;
  preHookHandler: (data: Partial<Item>) => Promise<void> | void;
  postHookHandler: (item: Item) => void;

  parentItemId?: string;

  constructor(member: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.actor = member;
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  abstract get name(): string;
  get status() { return this._status; }
  get result() { return this._result; }
  get message() { return this._message; }

  protected failWith(error: GraaspError) {
    this._status = TaskStatus.Fail;
    this._message = error.name;
    throw error;
  }

  abstract async run(handler: DatabaseTransactionHandler): Promise<void | BaseItemTask[]>;
}
