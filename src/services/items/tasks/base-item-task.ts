// global
import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import {
  IndividualResultType, PostHookHandlerType,
  PreHookHandlerType, Task, TaskStatus
} from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';

export abstract class BaseItemTask<T> implements Task<Actor, T> {
  protected itemService: ItemService;
  protected itemMembershipService: ItemMembershipService
  protected _result: T;
  protected _message: string;

  readonly actor: Member;
  readonly partialSubtasks: boolean;

  status: TaskStatus;
  targetId: string;
  data: Partial<IndividualResultType<T>>;
  preHookHandler?: PreHookHandlerType<T>;
  postHookHandler?: PostHookHandlerType<T>;

  /** id of the item to which some tasks will append the item being processed */
  parentItemId?: string;

  constructor(member: Member,
    itemService: ItemService, itemMembershipService: ItemMembershipService, partialSubtasks?: boolean) {
    this.actor = member;
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.partialSubtasks = partialSubtasks;
    this.status = 'NEW';
  }

  abstract get name(): string;
  get result(): T { return this._result; }
  get message(): string { return this._message; }

  abstract run(handler: DatabaseTransactionHandler, log?: FastifyLoggerInstance): Promise<void | BaseItemTask<T>[]>;
}
