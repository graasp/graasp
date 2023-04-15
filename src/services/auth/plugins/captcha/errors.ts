import { StatusCodes } from 'http-status-codes';

import { CoreError } from '../../../../utils/errors';

export class AuthenticationError extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR028',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'The authentication failed',
      },
      data,
    );
  }
}
