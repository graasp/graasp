import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

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
