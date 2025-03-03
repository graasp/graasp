import { isMember } from '../../authentication';
import { RessourceAuthorizationStrategy } from '../../authorization';
import { NotValidatedMember } from '../error';

/**
 * Strategy to check if user is validated.
 */
export const validatedMemberAccountRole: RessourceAuthorizationStrategy = {
  test: ({ user }) =>
    Boolean(
      user?.account && isMember(user.account) && user.account.isValidated,
    ),
  error: NotValidatedMember,
};
