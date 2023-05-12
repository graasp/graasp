import { ErrorFactory } from '@graasp/sdk';
import { StatusCodes } from 'http-status-codes';

export const GraaspPasswordError = ErrorFactory('graasp-plugin-password');

export class PasswordNotDefined extends GraaspPasswordError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPPWDERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'password is not defined',
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
        message: 'password is not strong enough',
      },
      data,
    );
  }
}
