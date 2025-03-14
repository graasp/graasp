import type { RessourceAuthorizationStrategy } from '../../auth/plugins/passport/index.js';
import { isMember } from '../../authentication.js';
import { NotValidatedMember } from '../error.js';

/**
 * Strategy to check if user is validated.
 */
export const validatedMemberAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.account && isMember(user.account) && user.account.isValidated),
  error: NotValidatedMember,
};
