import type { PassportUser } from 'fastify';

// Info parameter type can be specified if needed.
export type StrictVerifiedCallback = (
  // If not null, the authentication will fail, and the error message will be sent to the client.
  error: Error | null,

  // If defined, the user will be stored in the request object as `user` property.
  // If false, the authentication will fail with a 401 Unauthorize if no error is provided.
  user: PassportUser | false,

  info?: PassportInfo, // Data passed to `req.authInfo`
) => void;

export type CustomStrategyOptions = {
  // If true, the client will receive a more detailed error message, instead of a generic 401 Unauthorized.
  // We recommend setting this to true in development, and false in production.
  propagateError?: boolean;
};
export type PassportInfo = {
  emailValidation?: boolean; // True if the user logged from an email link.
};
