import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';
import { PLUGIN_NAME } from '../constants';


export const GraaspAppDataError = ErrorFactory(PLUGIN_NAME+'/app-data');

export class AppDataNotFound extends GraaspAppDataError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR004',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.APP_DATA_NOT_FOUND,
      },
      data,
    );
  }
}

export class AppDataNotAccessible extends GraaspAppDataError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR005',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.APP_DATA_NOT_ACCESSIBLE,
      },
      data,
    );
  }
}


export class PreventUpdateAppDataFile extends GraaspAppDataError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR008',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.PREVENT_APP_DATA_FILE_UPDATE,
      },
      data,
    );
  }
}

export class NotAppDataFile extends GraaspAppDataError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR009',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'App data is not a file',
      },
      data,
    );
  }
}
