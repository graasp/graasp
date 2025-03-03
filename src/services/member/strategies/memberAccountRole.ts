import { isMember } from '../../authentication';
import { RessourceAuthorizationStrategy } from '../../authorization';
import { NotMember } from '../error';

/**
 * Strategy to check if user is a member account.
 */
export const memberAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isMember(user.account)),
  error: NotMember,
};
