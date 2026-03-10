import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const AppSettingNotFound = createError(
  'GAERR007',
  FAILURE_MESSAGES.APP_SETTING_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const PreventUpdateAppSettingFile = createError(
  'GAERR009',
  FAILURE_MESSAGES.PREVENT_APP_SETTING_FILE_UPDATE,
  StatusCodes.FORBIDDEN,
);

export const NotAppSettingFile = createError(
  'GAERR010',
  'App setting is not a file',
  StatusCodes.BAD_REQUEST,
);
