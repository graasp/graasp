// global
import { ItemNotFound, TooManyMemberships, UserCannotAdminItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { ItemService } from '../../../services/items/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { ItemMembership } from '../interfaces/item-membership';
import { DeleteItemMembershipSubTask, DeleteItemMembershipTask } from './delete-item-membership-task';
import { MAX_ITEM_MEMBERSHIPS_FOR_DELETE } from '../../../util/config';

export class DeleteItemItemMembershipsTask extends BaseItemMembershipTask<ItemMembership> {
  // return main task's name so it is injected with the same hook handlers
  get name(): string { return DeleteItemMembershipTask.name; }

  constructor(member: Member, itemId: string,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.itemId = itemId;
  }

  async run(handler: DatabaseTransactionHandler): Promise<DeleteItemMembershipSubTask[]> {
    this.status = 'RUNNING';

    // get item of which all item-memberships (except member's), at or bellow, will be removed
    const item = await this.itemService.get(this.itemId, handler);
    if (!item) throw new ItemNotFound(this.itemId);

    // verify if member deleting the memberships has rights for that
    const hasRights = await this.itemMembershipService.canAdmin(this.actor.id, item, handler);
    if (!hasRights) throw new UserCannotAdminItem(item.id);

    // get all item membership at, and below, this item
    const itemMemberships = await this.itemMembershipService.getAllInSubtree(item, handler);
    if (itemMemberships.length > MAX_ITEM_MEMBERSHIPS_FOR_DELETE) throw new TooManyMemberships();

    this.status = 'DELEGATED';

    // return list of subtasks for task manager to execute and
    // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
    return itemMemberships
      .filter(im => im.memberId != this.actor.id) // exclude (possible) member's own membership
      .map(im => new DeleteItemMembershipSubTask(this.actor, im.id, this.itemService, this.itemMembershipService));
  }
}
