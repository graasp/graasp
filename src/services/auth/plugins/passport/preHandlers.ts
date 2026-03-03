import fastifyPassport from '@fastify/passport';
import type { FastifyRequest, RouteGenericInterface, RouteHandlerMethod } from 'fastify';

import { InsufficientPermission } from '../../../../utils/errors';
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
export const optionalIsAuthenticated = fastifyPassport.authenticate(
  // PassportStrategy.MobileJwt,
  PassportStrategy.Session,
);

/**
 * Validate authentication.
 * Will set the user to `request.user.member`.
 */
export const isAuthenticated = fastifyPassport.authenticate(
  // PassportStrategy.MobileJwt,
  PassportStrategy.StrictSession,
);

//-- Password Strategies --//
/**
 * Classic password authentication to create a session.
 */
export const authenticatePassword = fastifyPassport.authenticate(PassportStrategy.Password);

//-- JWT Strategies --//
/**
 * JWT authentication for password reset operation.
 */
export const authenticatePasswordReset = fastifyPassport.authenticate(
  PassportStrategy.PasswordReset,
  { session: false },
);

/**
 * JWT authentication for email change operation.
 */
export const authenticateEmailChange = fastifyPassport.authenticate(PassportStrategy.EmailChange, {
  session: false,
});

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

/**
 * Pre-handler function that checks if the user meets at least one of the specified access preconditions.
 * @param strategies The array of role strategies to check for access.
 * @throws {InsufficientPermission} If user does not satisfy any of the preconditions.
 * @throws {GraaspAuthError} If only one role strategy is provided and it failed with a provided error.
 */
export function matchOne<R extends RouteGenericInterface>(
  ...strategies: RessourceAuthorizationStrategy<R>[]
): RouteHandlerMethod {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return async (req: FastifyRequest<R>) => {
    if (!strategies.some((strategy) => strategy.test(req))) {
      // If none of the strategies pass, throw an error.

      // If only one strategy is provided, throw that error. Otherwise, throw a generic error.
      if (strategies.length === 1 && strategies[0].error) {
        throw new strategies[0].error();
      } else {
        throw new InsufficientPermission();
      }
    }
  };
}

export type RessourceAuthorizationStrategy<
  R extends RouteGenericInterface = RouteGenericInterface,
> = {
  test: (req: FastifyRequest<R>) => boolean;
  error?: new () => Error;
};
