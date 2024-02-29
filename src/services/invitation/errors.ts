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

export class NoDataFoundForInvitations extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR004',
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'No data or no column email detected',
    });
  }
}

export class NoEmailFoundForInvitations extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Email was not detected for rows',
      },
      data,
    );
  }
}

export class NoGroupNamesFoundForInvitations extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR006',
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Group column has been defined in CSV, but no group names were detected',
    });
  }
}

export class NoGroupFoundForInvitations extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Group column has been defined in CSV, but rows with missing groups exist',
      },
      data,
    );
  }
}

export class NoFileProvidedForInvitations extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'No file was provided. Please provide a file for creating bulk invitations',
      },
      data,
    );
  }
}
