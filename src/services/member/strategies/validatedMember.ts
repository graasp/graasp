import { RessourceAuthorizationStrategy } from '../../authorization';
import { NotValidatedMember } from '../error';

/**
 * Strategy to check if user is validated.
 */
export const validatedMember: RessourceAuthorizationStrategy = {
  test: ({ user }) => Boolean(user?.member?.isValidated),
  error: NotValidatedMember,
};
