import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const NotAppItem = createError(
  'GAERR001',
  FAILURE_MESSAGES.NOT_APP_ITEM,
  StatusCodes.BAD_REQUEST,
);

export const InvalidApplicationOrigin = createError(
  'GAERR002',
  FAILURE_MESSAGES.INVALID_APP_ORIGIN,
  StatusCodes.FORBIDDEN,
);

export const TokenItemIdMismatch = createError(
  'GAERR003',
  FAILURE_MESSAGES.TOKEN_ITEM_ID_MISMATCH,
  StatusCodes.UNAUTHORIZED,
);