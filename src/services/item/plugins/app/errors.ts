import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspAppsError = ErrorFactory(PLUGIN_NAME);

export class NotAppItem extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.NOT_APP_ITEM,
      },
      data,
    );
  }
}

export class InvalidApplicationOrigin extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.INVALID_APP_ORIGIN,
      },
      data,
    );
  }
}

export class TokenItemIdMismatch extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR003',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.TOKEN_ITEM_ID_MISMATCH,
      },
      data,
    );
  }
}
