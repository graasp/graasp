import { RessourceAuthorizationStrategy } from '../../auth/plugins/passport';
import { isMember } from '../../authentication';
import { NotMember } from '../error';

/**
 * Strategy to check if user is a member account.
 */
export const memberAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isMember(user.account)),
  error: NotMember,
};
