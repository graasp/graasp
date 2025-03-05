import { StatusCodes } from 'http-status-codes';

import { AccountType, AuthenticatedUser, MinimalGuest, MinimalMember } from '../types';
import { NotMember } from './member/error';

export function isMember(account: AuthenticatedUser): account is MinimalMember {
  return account.type === AccountType.Individual;
}

export function isGuest(account: AuthenticatedUser): account is MinimalGuest {
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
