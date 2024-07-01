import { InvalidatedMember } from '../../../error';
import { RoleStrategy } from '../types';

/**
 * Strategy to check if user is validated.
 */
export const validatedMember: RoleStrategy = {
  test: (user) => !!user?.member?.isValidated,
  error: InvalidatedMember,
};
