import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspInvitationsError = ErrorFactory(PLUGIN_NAME);

export class DuplicateInvitationError extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR001',
        statusCode: StatusCodes.CONFLICT,
        message: 'An invitation already exists for this item and email pair',
      },
      data,
    );
  }
}

export class MemberAlreadyExistForEmailError extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR002',
        statusCode: StatusCodes.CONFLICT,
        message: 'This email is already associated with a member',
      },
      data,
    );
  }
}

export class InvitationNotFound extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR003',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Invitation not found',
      },
      data,
    );
  }
}
