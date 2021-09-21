// global
import { FastifyLoggerInstance } from 'fastify';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { Item } from '../interfaces/item';
import { BaseItemTask } from './base-item-task';

export class GetOwnItemsTask extends BaseItemTask<Item[]> {
  get name(): string {
    return GetOwnItemsTask.name;
  }

  constructor(
    member: Member,
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
  ) {
    super(member, itemService, itemMembershipService);
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = 'RUNNING';

    const memberId = this.actor.id;

    // get member's "own" items (created by member and where member is admin)
    const items = await this.itemService.getOwn(memberId, handler);

    this.postHookHandler?.(items, this.actor, { log, handler });

    this.status = 'OK';
    this._result = items;
  }
}
