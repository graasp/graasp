import { RessourceAuthorizationStrategy } from '../../auth/plugins/passport/index.js';
import { isMember } from '../../authentication.js';
import { NotMember } from '../error.js';

/**
 * Strategy to check if user is a member account.
 */
export const memberAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isMember(user.account)),
  error: NotMember,
};
