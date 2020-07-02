export enum PermissionLevel {
  Read = 'read',
  Write = 'write',
  Admin = 'admin'
}

export class PermissionLevelCompare {
  static gt = (a: PermissionLevel, b: PermissionLevel) =>
    (a === PermissionLevel.Admin && (b === PermissionLevel.Write || b === PermissionLevel.Read)) ||
    (a === PermissionLevel.Write && b === PermissionLevel.Read);

  static gte = (a: PermissionLevel, b: PermissionLevel) => a === b || PermissionLevelCompare.gt(a, b);

  static lt = (a: PermissionLevel, b: PermissionLevel) =>
    (a === PermissionLevel.Read && (b === PermissionLevel.Write || b === PermissionLevel.Admin)) ||
    (a === PermissionLevel.Write && b === PermissionLevel.Admin);

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
