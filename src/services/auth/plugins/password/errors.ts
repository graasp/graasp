import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const PasswordNotDefined = createError(
  'GPPWDERR001',
  FAILURE_MESSAGES.PASSWORD_NOT_DEFINED_ERROR,
  StatusCodes.BAD_REQUEST,
);

export const PasswordNotStrong = createError(
  'GPPWDERR002',
  FAILURE_MESSAGES.PASSWORD_WEAK_ERROR,
  StatusCodes.BAD_REQUEST,
);

export const PasswordConflict = createError(
  'GPPWDERR003',
  FAILURE_MESSAGES.PASSWORD_CONFLICT_ERROR,
  StatusCodes.CONFLICT,
);
