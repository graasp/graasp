import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspInvitationsError = ErrorFactory(PLUGIN_NAME);

export class InvitationNotFound extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR003',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.INVITATION_NOT_FOUND,
      },
      data,
    );
  }
}

export class MissingEmailColumnInCSVError extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR005',
      statusCode: StatusCodes.BAD_REQUEST,
      message: FAILURE_MESSAGES.INVITATION_CSV_MISSING_EMAIL_COLUMN,
    });
  }
}

export class MissingGroupColumnInCSVError extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR006',
      statusCode: StatusCodes.BAD_REQUEST,
      message: FAILURE_MESSAGES.INVITATION_CSV_MISSING_GROUP_COLUMN,
    });
  }
}

export class MissingEmailInRowError extends GraaspInvitationsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPINVERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVITATION_CSV_MISSING_EMAIL_IN_ROW,
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
        message: FAILURE_MESSAGES.INVITATION_CSV_MISSING_GROUP_IN_ROW,
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
        message: FAILURE_MESSAGES.INVITATION_CSV_NO_FILE_PROVIDED,
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
        message: FAILURE_MESSAGES.INVITATION_CSV_NO_DATA_IN_FILE,
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
        message: FAILURE_MESSAGES.INVITATION_CANNOT_CREATE_STRUCTURE_IN_NON_FOLDER_ITEM,
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
        message: FAILURE_MESSAGES.INVITATION_CSV_TEMPLATE_ITEM_DOES_NOT_EXIST,
      },
      data,
    );
  }
}

export class NoInvitationReceivedFound extends GraaspInvitationsError {
  constructor() {
    super({
      code: 'GPINVERR015',
      statusCode: StatusCodes.BAD_REQUEST,
      message: FAILURE_MESSAGES.NO_INVITATION_RECEIVED,
    });
  }
}
