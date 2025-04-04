import { RessourceAuthorizationStrategy } from '../../auth/plugins/passport';
import { isGuest } from '../../authentication';
import { NotGuest } from '../errors';

/**
 * Strategy to check if user is a Guest Account.
 */
export const guestAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isGuest(user.account)),
  error: NotGuest,
};
