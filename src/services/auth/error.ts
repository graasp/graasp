import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-auth';

export const GraaspAuthError = ErrorFactory(PLUGIN_NAME);

export class InsufficientPermission extends GraaspAuthError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAUTHERR001',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'User has insufficient permission to perform this action',
      },
      data,
    );
  }
}

export class InvalidatedMember extends GraaspAuthError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAUTHERR001',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Member has not been validated by email',
      },
      data,
    );
  }
}
