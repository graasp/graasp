import { RessourceAuthorizationStrategy } from '../../authorization';
import { isGuest } from '../entities/guest';
import { NotGuest } from '../errors';

/**
 * Strategy to check if user is a Guest Account.
 */
export const guestAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isGuest(user.account)),
  error: NotGuest,
};
