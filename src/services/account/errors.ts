import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export const GraaspAccountError = ErrorFactory('graasp-plugin-account');

export class AccountNotFound extends GraaspAccountError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAECCRR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.ACCOUNT_NOT_FOUND,
      },
      data,
    );
  }
}
