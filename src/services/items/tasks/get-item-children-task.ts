// global
import { ItemNotFound, UserCannotReadItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';

export class GetItemChildrenTask extends BaseItemTask<Item[]> {
  get name(): string { return GetItemChildrenTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // verify membership rights over item
    const hasRights = await this.itemMembershipService.canRead(this.actor, item, handler);
    if (!hasRights) throw new UserCannotReadItem(this.targetId);

    // get item's children
    const children = await this.itemService.getDescendants(item, handler, 'ASC', 1);

    this.status = 'OK';
    this._result = children;
  }
}
