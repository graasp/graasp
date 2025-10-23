import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from '../constants';

export const GraaspAppSettingError = ErrorFactory(PLUGIN_NAME + '/app-setting');

export class AppSettingNotFound extends GraaspAppSettingError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR007',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.APP_SETTING_NOT_FOUND,
      },
      data,
    );
  }
}

export class PreventUpdateAppSettingFile extends GraaspAppSettingError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR009',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.PREVENT_APP_SETTING_FILE_UPDATE,
      },
      data,
    );
  }
}

export class NotAppSettingFile extends GraaspAppSettingError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR010',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'App setting is not a file',
      },
      data,
    );
  }
}
