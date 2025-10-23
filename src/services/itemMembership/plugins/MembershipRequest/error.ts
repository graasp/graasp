import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-member';

export const GraaspMembershipRequestError = ErrorFactory(PLUGIN_NAME);
export class ItemMembershipAlreadyExists extends GraaspMembershipRequestError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMRERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.MEMBERSHIP_ALREADY_EXISTS,
      },
      data,
    );
  }
}

export class MembershipRequestAlreadyExists extends GraaspMembershipRequestError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMRERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.MEMBERSHIP_REQUEST_ALREADY_EXISTS,
      },
      data,
    );
  }
}

export class MembershipRequestNotFound extends GraaspMembershipRequestError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMRERR003',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.MEMBERSHIP_REQUEST_NOT_FOUND,
      },
      data,
    );
  }
}
