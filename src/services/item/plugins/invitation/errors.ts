import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { EMAIL_COLUMN_NAME, GROUP_COL_NAME, PLUGIN_NAME } from './constants.js';

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

export class MissingEmailColumnInCSVError extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR005',
      statusCode: StatusCodes.BAD_REQUEST,
      message: `The required "${EMAIL_COLUMN_NAME}" column was not provided`,
    });
  }
}

export class MissingGroupColumnInCSVError extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR006',
      statusCode: StatusCodes.BAD_REQUEST,
      message: `The required "${GROUP_COL_NAME}" column was not provided.`,
    });
  }
}

export class MissingEmailInRowError extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `A row is missing the required "${EMAIL_COLUMN_NAME}" value`,
      },
      data,
    );
  }
}

export class MissingGroupInRowError extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `A row is missing the required "${GROUP_COL_NAME}" value`,
      },
      data,
    );
  }
}

export class NoGroupNamesFoundForInvitations extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR009',
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Group column has been defined in CSV, but no group names were detected',
    });
  }
}

export class NoGroupFoundForInvitations extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR010',
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
        code: 'GPINVERR011',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'No file was provided. Please provide a file for creating bulk invitations',
      },
      data,
    );
  }
}

export class NoDataInFile extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR012',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'No data was found in the file. Please send a file with valid data.',
      },
      data,
    );
  }
}

export class CantCreateStructureInNoFolderItem extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR013',
        statusCode: StatusCodes.BAD_REQUEST,
        message:
          'Provided item is not a folder. A structure cannot be created inside an item that is not a folder.',
      },
      data,
    );
  }
}

export class TemplateItemDoesNotExist extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR014',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'The template item does not exist.',
      },
      data,
    );
  }
}
