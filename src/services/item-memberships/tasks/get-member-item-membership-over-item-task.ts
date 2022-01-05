// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Item } from '../../items/interfaces/item';
import { Member } from '../../members/interfaces/member';
// local
import { ItemMembershipService } from '../db-service';
import { ItemMembership, PermissionLevel } from '../interfaces/item-membership';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../util/graasp-error';
import { BaseItemMembershipTask } from './base-item-membership-task';
import { TaskStatus } from '../../..';

export type GetMemberItemMembershipOverItemTaskInputType = {
  item?: Item;
  validatePermission?: PermissionLevel;
};

export class GetMemberItemMembershipOverItemTask extends BaseItemMembershipTask<ItemMembership> {
  get name(): string {
    return GetMemberItemMembershipOverItemTask.name;
  }

  input: GetMemberItemMembershipOverItemTaskInputType;
  getInput: () => GetMemberItemMembershipOverItemTaskInputType;

  constructor(
    member: Member,
    itemMembershipService: ItemMembershipService,
    input?: GetMemberItemMembershipOverItemTaskInputType,
  ) {
    super(member, itemMembershipService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item, validatePermission } = this.input;

    // verify membership rights over item
    const membership = await this.itemMembershipService.getForMemberAtItem(
      this.actor.id,
      item,
      handler,
    );
    if (!membership) throw new MemberCannotAccess(item.id);

    if (validatePermission) {
      const { permission: p } = membership;

      switch (validatePermission) {
        case PermissionLevel.Read:
          break;
        case PermissionLevel.Write:
          if (p !== PermissionLevel.Write && p !== PermissionLevel.Admin) {
            throw new MemberCannotWriteItem(item.id);
          }
          break;
        case PermissionLevel.Admin:
          if (p !== PermissionLevel.Admin) {
            throw new MemberCannotWriteItem(item.id);
          }
          break;
      }
    }

    this.status = TaskStatus.OK;
    this._result = membership;
  }
}
