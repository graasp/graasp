import { Static, Type } from '@sinclair/typebox';

import type { UnionOfConst } from '@graasp/sdk';

import { registerSchemaAsRef } from './plugins/typebox';

export const AccountType = {
  Individual: 'individual',
  Guest: 'guest',
} as const;
export type AccountTypeOptions = UnionOfConst<typeof AccountType>;

/**
 * A minimal user, only contains the id and name.
 */
type MinimalUser = {
  id: string;
  name: string;
  lang?: string;
};

/**
 * A minimal member as given by the authentication functions.
 *
 * This should be all that is needed to handle most member requests.
 *
 * In cases where further member info is required, the full member should be fetched from the database.
 */
export type MinimalMember = MinimalUser & {
  type: typeof AccountType.Individual;
  isValidated: boolean;
};

/**
 * A minimal guest as given by the authentication functions.
 *
 * This should be all that is needed to handle guests in most cases.
 *
 * In cases where more information on the guest is needed, the full guest info should be queried from the database.
 */
export type MinimalGuest = MinimalUser & {
  type: typeof AccountType.Guest;
};

/**
 * The authenticated user as given by the authentication functions.
 * Is can be a member (real account) or a guest (only has access to a single item)
 */
export type AuthenticatedUser = MinimalMember | MinimalGuest;

/**
 * Sometimes we do not care if the person making the request exists or not
 */
export type MaybeUser = AuthenticatedUser | undefined;

/**
 * Whenever the member needs to be manipulated with lang and email
 */
export type MemberInfo = MinimalMember & {
  lang: string;
  email: string;
  enableSaveActions?: boolean | null;
};

export type IdParam = {
  id: string;
};

export type IdsParams = {
  id: string[];
};

export type NonEmptyArray<T> = [T, ...T[]];
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

export type KeysWithValsOfType<T, V> = keyof {
  [P in keyof T as T[P] extends V ? P : never]: P;
};
export type KeysOfString<T> = KeysWithValsOfType<T, string>;

const permissionLevelSchema = Type.Union([
  Type.Literal('read'),
  Type.Literal('write'),
  Type.Literal('admin'),
]);
export type PermissionLevel = Static<typeof permissionLevelSchema>;

export const permissionLevelSchemaRef = registerSchemaAsRef(
  'permissionLevel',
  'PermissionLevel',
  permissionLevelSchema,
);
