import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

const PLUGIN_NAME = 'graasp-plugin-member';

export const GraaspMemberError = ErrorFactory(PLUGIN_NAME);
export class EmailAlreadyTaken extends GraaspMemberError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMERR001',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.EMAIL_ALREADY_TAKEN,
      },
      data,
    );
  }
}

export class NotValidatedMember extends GraaspMemberError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.NOT_VALIDATED_MEMBER,
      },
      data,
    );
  }
}

export class NotMember extends GraaspMemberError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMERR003',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.NOT_A_MEMBER,
      },
      data,
    );
  }
}
