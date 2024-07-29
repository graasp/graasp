import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export const GraaspPasswordError = ErrorFactory('graasp-plugin-password');

export class PasswordNotDefined extends GraaspPasswordError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPPWDERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.PASSWORD_NOT_DEFINED_ERROR,
      },
      data,
    );
  }
}

export class PasswordNotStrong extends GraaspPasswordError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPPWDERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.PASSWORD_WEAK_ERROR,
      },
      data,
    );
  }
}

export class PasswordConflict extends GraaspPasswordError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPPWDERR003',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.PASSWORD_CONFLICT_ERROR,
      },
      data,
    );
  }
}
