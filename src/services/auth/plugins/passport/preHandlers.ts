import fastifyPassport from '@fastify/passport';

import { PassportStrategy } from './strategies';

// Validate authentication. Allows public authentication.
// Will set the user to `request.user.member` if possible.
export const optionalAuthenticated = fastifyPassport.authenticate([
  PassportStrategy.JWT,
  PassportStrategy.SESSION,
]);

// Validate authentication.
// Will set the user to `request.user.member`.
export const authenticated = fastifyPassport.authenticate([
  PassportStrategy.JWT,
  PassportStrategy.STRICT_SESSION,
]);

//-- Password Strategies --//
// Classic password authentication to create a session.
export const authenticatePassword = fastifyPassport.authenticate(PassportStrategy.PASSWORD);

//-- Magic Link Strategies --//
// Classic magic link authentication to create a session.
export const authenticateMobileMagicLink = fastifyPassport.authenticate(
  PassportStrategy.MOBILE_MAGIC_LINK,
);

//-- JWT Strategies --//
// JWT authentication for password reset operation.
export const authenticatePasswordReset = fastifyPassport.authenticate(
  PassportStrategy.PASSPORT_RESET,
  { session: false },
);
// Refresh Token for mobile authentication
export const authenticateRefreshToken = fastifyPassport.authenticate(
  PassportStrategy.REFRESH_TOKEN,
  { session: false },
);
// Mobile Authentication
export const authenticateJWTChallengeVerifier = fastifyPassport.authenticate(
  PassportStrategy.JWT_CHALLENGE_VERIFIER,
  { session: false },
);

// Items app authentication
export const authenticateAppsJWT = fastifyPassport.authenticate(PassportStrategy.APPS_JWT, {
  session: false,
});
// Items app authentication. Allows public authentication.
export const optionalAuthenticateAppsJWT = fastifyPassport.authenticate(
  PassportStrategy.OPTIONAL_APPS_JWT,
  {
    session: false,
  },
);
