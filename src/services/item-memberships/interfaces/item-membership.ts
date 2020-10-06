export enum PermissionLevel {
  Read = 'read',
  Write = 'write',
  Admin = 'admin'
}

export class PermissionLevelCompare {
  /**
   * `a` is a better permission level when compared to `b`
   */
  static gt = (a: PermissionLevel, b: PermissionLevel) =>
    (a === PermissionLevel.Admin && (b === PermissionLevel.Write || b === PermissionLevel.Read)) ||
    (a === PermissionLevel.Write && b === PermissionLevel.Read);

  /**
   * `a` is a better, or the same, permission level when compared to `b`.
   */
  static gte = (a: PermissionLevel, b: PermissionLevel) => a === b || PermissionLevelCompare.gt(a, b);

  /**
   * `a` is a worse permission level when compared to `b`.
   */
  static lt = (a: PermissionLevel, b: PermissionLevel) =>
    (a === PermissionLevel.Read && (b === PermissionLevel.Write || b === PermissionLevel.Admin)) ||
    (a === PermissionLevel.Write && b === PermissionLevel.Admin);

  /**
   * `a` is a worse, or the same, permission level when compared to `b`.
   */
  static lte = (a: PermissionLevel, b: PermissionLevel) => a === b || PermissionLevelCompare.lt(a, b);
}

export interface ItemMembership {
  id: string;
  memberId: string;
  itemPath: string;
  permission: PermissionLevel;
  creator: string;
  createdAt: string;
  updatedAt: string;
}
