import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const AuthenticationError = createError(
  'GERR028',
  'The authentication failed',
  StatusCodes.UNAUTHORIZED,
);
