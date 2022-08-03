import { ItemMembership, PermissionLevel } from '@graasp/sdk';

export class BaseItemMembership implements ItemMembership {
  readonly id: string;
  readonly memberId: string;
  readonly itemPath: string;
  permission: PermissionLevel;
  readonly creator: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(
    memberId: string,
    itemPath: string,
    permission = PermissionLevel.Read,
    creator: string,
  ) {
    this.memberId = memberId;
    this.itemPath = itemPath;
    this.permission = permission;
    this.creator = creator;
  }
}
