import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspMemberProfileError = ErrorFactory('graasp-member-profile');

export class MemberProfileNotFound extends GraaspMemberProfileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GMPERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Member Profile not found',
      },
      data,
    );
  }
}
