import { StatusCodes } from 'http-status-codes';

import { AccountRaw } from '../drizzle/types';
import { AccountType, AuthenticatedUser, MinimalGuest, MinimalMember } from '../types';
import { NotMember } from './member/error';

// TODO: allow AccountRow or apply DTO on all relations?
export function isMember(account: AuthenticatedUser | AccountRaw): account is MinimalMember {
  return account.type === AccountType.Individual;
}

// TODO: allow AccountRow or apply DTO on all relations?
export function isGuest(account: AuthenticatedUser | AccountRaw): account is MinimalGuest {
  return account.type === AccountType.Guest;
}

export function assertIsMember<Err extends Error, Args extends unknown[]>(
  account: AuthenticatedUser,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts account is MinimalMember {
  if (account.type !== AccountType.Individual) {
    if (error) {
      throw new error(...args);
    } else {
      const defaultError = new NotMember();
      defaultError.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      throw defaultError;
    }
  }
}
