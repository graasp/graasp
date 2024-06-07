import fastifyPassport from '@fastify/passport';

import { PassportStrategy } from './strategies';

/**
 * Passport Authenticate function will accept the authenticaction if at least one of the strategies is successful.
 * So we can use multiple strategies to authenticate the user and the first one that succeeds will be used.
 *
 * All prehandlers in Fastify has to be successfull to continue the request.
 * So if we want the client to validate a captcha AND being authenticated, we have to use :
 * preHandler: [captchaPreHandler(...), authenticated]
 */

/**
 * Validate authentication. Allows public authentication, can't fail.
 * Will set the user to `request.user.member` if possible.
 */
export const optionalIsAuthenticated = fastifyPassport.authenticate([
  PassportStrategy.Jwt,
  PassportStrategy.Session,
]);

/**
 * Validate authentication.
 * Will set the user to `request.user.member`.
 */
export const isAuthenticated = fastifyPassport.authenticate([
  PassportStrategy.Jwt,
  PassportStrategy.StrictSession,
]);

//-- Password Strategies --//
/**
 * Classic password authentication to create a session.
 */
export const authenticatePassword = fastifyPassport.authenticate(PassportStrategy.Password);

//-- Magic Link Strategies --//
/**
 * Classic magic link authentication to create a session.
 */
export const authenticateMobileMagicLink = fastifyPassport.authenticate(
  PassportStrategy.MobileMagicLink,
);

//-- JWT Strategies --//
/**
 * JWT authentication for password reset operation.
 */
export const authenticatePasswordReset = fastifyPassport.authenticate(
  PassportStrategy.PasswordReset,
  { session: false },
);

/**
 * Refresh Token for mobile authentication
 */
export const authenticateRefreshToken = fastifyPassport.authenticate(
  PassportStrategy.RefreshToken,
  { session: false },
);

/**
 * Mobile Authentication
 */
export const authenticateJWTChallengeVerifier = fastifyPassport.authenticate(
  PassportStrategy.JwtChallengeVerifier,
  { session: false },
);

/**
 * Items app authentication
 */
export const authenticateAppsJWT = fastifyPassport.authenticate(PassportStrategy.AppsJwt, {
  session: false,
});

/**
 *  Items app authentication. Allows authentication without member, can fail if item is not found.
 */
export const guestAuthenticateAppsJWT = fastifyPassport.authenticate(
  PassportStrategy.OptionalAppsJwt,
  {
    session: false,
  },
);
