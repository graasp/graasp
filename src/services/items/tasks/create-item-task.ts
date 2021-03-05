// global
import {
  ItemNotFound, UserCannotWriteItem,
  HierarchyTooDeep, TooManyChildren
} from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_TREE_LEVELS, MAX_NUMBER_OF_CHILDREN } from '../../../util/config';
import { UnknownExtra } from '../../../interfaces/extra';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
import { PermissionLevel as pl } from '../../../services/item-memberships/interfaces/item-membership';
import { BaseItemMembership } from '../../../services/item-memberships/base-item-membership';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
import { BaseItem } from '../base-item';

export class CreateItemTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string { return CreateItemTask.name; }

  constructor(member: Member, data: Partial<Item<E>>,
    itemService: ItemService, itemMembershipService: ItemMembershipService,
    parentItemId?: string) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.parentItemId = parentItemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';
    let parentItem;
    let parentItemPermissionLevel;

    if (this.parentItemId) {
      // get parent item
      parentItem = await this.itemService.get(this.parentItemId, handler);
      if (!parentItem) throw new ItemNotFound(this.parentItemId);

      // verify membership rights over parent item
      parentItemPermissionLevel = await this.itemMembershipService.getPermissionLevel(this.actor.id, parentItem, handler);
      if (!parentItemPermissionLevel || parentItemPermissionLevel === pl.Read) {
        throw new UserCannotWriteItem(this.parentItemId);
      }

      // check if hierarchy it too deep
      if (BaseItem.itemDepth(parentItem) + 1 > MAX_TREE_LEVELS) {
        throw new HierarchyTooDeep();
      }

      // check if there's too many children under the same parent
      const numberOfChildren = await this.itemService.getNumberOfChildren(parentItem, handler);
      if (numberOfChildren + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }
    }

    // create item
    const { name, description, type, extra } = this.data;
    const { id: creator } = this.actor;
    let item = new BaseItem(name, description, type, extra, creator, parentItem);
    item = await this.itemService.create(item, handler);

    // create 'admin' membership for member+item if it's a 'root' item (no parent item) or
    // if the member only has 'write' membership in parent item.
    if (!parentItem || parentItemPermissionLevel === pl.Write) {
      const membership = new BaseItemMembership(this.actor.id, item.path, pl.Admin, this.actor.id);
      await this.itemMembershipService.create(membership, handler);
    }

    this.status = 'OK';
    this._result = item;
  }
}
