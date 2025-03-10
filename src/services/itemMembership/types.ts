import { UnionOfConst } from '@graasp/sdk';

export const PermissionLevel = {
  Read: 'read',
  Write: 'write',
  Admin: 'admin',
} as const;
export type PermissionLevelOptions = UnionOfConst<typeof PermissionLevel>;
