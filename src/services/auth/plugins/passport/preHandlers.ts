import fastifyPassport from '@fastify/passport';

import { PassportStrategy } from './strategies';

// PreHandlers are defined here, so we can change used library if needed.

export const optionalAuthenticated = fastifyPassport.authenticate([
  PassportStrategy.JWT,
  PassportStrategy.SESSION,
]);

export const authenticated = fastifyPassport.authenticate([
  PassportStrategy.JWT,
  PassportStrategy.STRICT_SESSION,
]);

//-- Password Strategies --//
export const authenticatePassword = fastifyPassport.authenticate(PassportStrategy.PASSWORD);

//-- Magic Link Strategies --//
export const authenticateMobileMagicLink = fastifyPassport.authenticate(
  PassportStrategy.MOBILE_MAGIC_LINK,
);

//-- JWT Strategies --//
export const authenticatePasswordReset = fastifyPassport.authenticate(
  PassportStrategy.PASSPORT_RESET,
  { session: false },
);
export const authenticateRefreshToken = fastifyPassport.authenticate(
  PassportStrategy.REFRESH_TOKEN,
  { session: false },
);
export const authenticateJWTChallengeVerifier = fastifyPassport.authenticate(
  PassportStrategy.JWT_CHALLENGE_VERIFIER,
  { session: false },
);
