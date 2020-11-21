// global
import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';

export class GetItemTask extends BaseItemTask {
  get name(): string { return GetItemTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this._status = TaskStatus.Running;

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) this.failWith(new GraaspError(GraaspError.ItemNotFound, this.targetId));

    // verify membership rights over item
    const hasRights = await this.itemMembershipService.canRead(this.actor, item, handler);
    if (!hasRights) this.failWith(new GraaspError(GraaspError.UserCannotReadItem, this.targetId));

    this._status = TaskStatus.OK;
    this._result = item;
  }
}
