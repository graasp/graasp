import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const AppActionNotAccessible = createError(
  'GAERR006',
  FAILURE_MESSAGES.APP_ACTION_NOT_ACCESSIBLE,
  StatusCodes.FORBIDDEN,
);
