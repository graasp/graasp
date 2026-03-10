import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';
import type { AccountRaw, MemberRaw } from '../drizzle/types';
import {
  AccountType,
  type AuthenticatedUser,
  type MinimalGuest,
  type MinimalMember,
} from '../types';
import { NotMemberOrGuest } from './account/errors';

// TODO: allow AccountRow or apply DTO on all relations?
export function isMember(account: AuthenticatedUser | AccountRaw): account is MinimalMember {
  return account.type === AccountType.Individual;
}

// TODO: allow AccountRow or apply DTO on all relations?
export function isGuest(account: AuthenticatedUser | AccountRaw): account is MinimalGuest {
  return account.type === AccountType.Guest;
}


export const AssertNotMember = createError(
  'AGMERR003',
  FAILURE_MESSAGES.NOT_A_MEMBER,
  StatusCodes.INTERNAL_SERVER_ERROR,
);


export function assertIsMember<Err extends Error, Args extends unknown[]>(
  account: AuthenticatedUser | AccountRaw,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts account is MinimalMember {
  if (account.type !== AccountType.Individual) {
    if (error) {
      throw new error(...args);
    } else {
      throw new AssertNotMember();
    }
  }
}

export function assertIsMemberForTest<Err extends Error, Args extends unknown[]>(
  account: AuthenticatedUser | Omit<AccountRaw, 'itemLoginSchemaId'>,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts account is MemberRaw {
  if (account.type !== AccountType.Individual) {
    if (error) {
      throw new error(...args);
    } else {
      throw new AssertNotMember();
    }
  }
}

export function assertIsMemberOrGuest<Err extends Error, Args extends unknown[]>(
  account: AuthenticatedUser,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts account is MinimalMember | MinimalGuest {
  if (!(isMember(account) || isGuest(account))) {
    if (error) {
      throw new error(...args);
    } else {
      throw new NotMemberOrGuest();
    }
  }
}
