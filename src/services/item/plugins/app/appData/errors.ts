import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const AppDataNotFound = createError(
  'GAERR004',
  FAILURE_MESSAGES.APP_DATA_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const AppDataNotAccessible = createError(
  'GAERR005',
  FAILURE_MESSAGES.APP_DATA_NOT_ACCESSIBLE,
  StatusCodes.FORBIDDEN,
);

export const PreventUpdateAppDataFile = createError(
  'GAERR008',
  FAILURE_MESSAGES.PREVENT_APP_DATA_FILE_UPDATE,
  StatusCodes.FORBIDDEN,
);

export const PreventUpdateOtherAppData = createError(
  'GAERR009',
  FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS,
  StatusCodes.FORBIDDEN,
);

export const NotAppDataFile = createError(
  'GAERR010',
  'App data is not a file',
  StatusCodes.BAD_REQUEST,
);
