// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { IndividualResultType, Task, TaskStatus } from '../../../interfaces/task';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';

export abstract class BaseItemMembershipTask<T> implements Task<Member, T> {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected _result: T;
  protected _message: string;

  readonly actor: Member;

  status: TaskStatus;
  targetId: string;
  data: Partial<IndividualResultType<T>>;

  /** Id of the item to which the ItemMembership is linked to */
  itemId?: string;

  constructor(actor: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.actor = actor;
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.status = 'NEW';
  }

  abstract get name(): string;
  get result(): T { return this._result; }
  get message(): string { return this._message; }

  abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseItemMembershipTask<T>[]>;
}
