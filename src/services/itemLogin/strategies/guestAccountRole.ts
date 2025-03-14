import { RessourceAuthorizationStrategy } from '../../auth/plugins/passport/index.js';
import { isGuest } from '../../authentication.js';
import { NotGuest } from '../errors.js';

/**
 * Strategy to check if user is a Guest Account.
 */
export const guestAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isGuest(user.account)),
  error: NotGuest,
};
