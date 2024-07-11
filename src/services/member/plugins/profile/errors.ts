import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export const GraaspMemberProfileError = ErrorFactory('graasp-member-profile');

export class MemberProfileNotFound extends GraaspMemberProfileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMPERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.MEMBER_PROFILE_NOT_FOUND,
      },
      data,
    );
  }
}
