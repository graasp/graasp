import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export const GraaspMemberProfileError = ErrorFactory('graasp-member-profile');

export class MemberProfileNotFound extends GraaspMemberProfileError {
  constructor() {
    super({
      code: 'GMPERR001',
      statusCode: StatusCodes.NOT_FOUND,
      message: FAILURE_MESSAGES.MEMBER_PROFILE_NOT_FOUND,
    });
  }
}

export class MemberProfileCreationError extends GraaspMemberProfileError {
  constructor() {
    super({
      code: 'GMPERR002',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Could not create member profile. This is an internal server error',
    });
  }
}

export class MemberProfilePropertiesEmpty extends GraaspMemberProfileError {
  constructor() {
    super({
      code: 'GMPERR003',
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'All properties of the member profile are empty',
    });
  }
}
