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

const sortChildrenWith = (idsOrder: string[]) =>
  (stElem: { id: string }, ndElem: { id: string }) =>
    idsOrder.indexOf(stElem.id) - idsOrder.indexOf(ndElem.id);

export class GetItemChildrenTask extends BaseItemTask<Item[]> {
  get name(): string { return GetItemChildrenTask.name; }

  private ordered: boolean;

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    ordered?: boolean) {
    super(member, itemService, itemMembershipService);
    this.targetId = itemId;
    this.ordered = ordered;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get item
    const item = await this.itemService
      .get<{ folder: { childrenOrder: string[] } }>(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // verify membership rights over item
    const hasRights = await this.itemMembershipService.canRead(this.actor.id, item, handler);
    if (!hasRights) throw new UserCannotReadItem(this.targetId);

    // get item's children
    const children = await this.itemService.getDescendants(item, handler, 'ASC', 1);

    if (this.ordered) {
      const { extra: { folder: { childrenOrder = [] } = {} } } = item;

      if (childrenOrder.length) {
        const compareFn = sortChildrenWith(childrenOrder);
        children.sort(compareFn);
      }
    }

    this.status = 'OK';
    this._result = children;
  }
}
