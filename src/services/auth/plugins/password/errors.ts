import { ErrorFactory } from '@graasp/sdk';
import { StatusCodes } from 'http-status-codes';

export const CoreError = ErrorFactory('graasp-plugin-password');

export class PasswordNotDefined extends CoreError {
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
