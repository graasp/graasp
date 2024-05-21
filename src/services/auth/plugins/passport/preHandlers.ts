import fastifyPassport from '@fastify/passport';

import { PassportStrategy } from './strategies';

// PreHandlers are defined here, so we can change used library if needed.

export const authenticated = fastifyPassport.authenticate([
  PassportStrategy.JWT,
  PassportStrategy.SESSION,
]);

export const authenticatePassword = fastifyPassport.authenticate(PassportStrategy.PASSWORD);
export const authenticateRefreshPassword = fastifyPassport.authenticate(
  PassportStrategy.REFRESH_TOKEN,
);
export const authenticateJWTChallengeVerifier = fastifyPassport.authenticate(
  PassportStrategy.JWT_CHALLENGE_VERIFIER,
);
export const authenticateMobileMagicLink = fastifyPassport.authenticate(
  PassportStrategy.MOBILE_MAGIC_LINK,
);
export const authenticatePasswordReset = fastifyPassport.authenticate(
  PassportStrategy.PASSPORT_RESET,
  { session: false }, // Session is not required.
);
