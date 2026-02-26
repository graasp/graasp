import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const InvitationNotFound = createError(
  'GPINVERR003',
  FAILURE_MESSAGES.INVITATION_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const MissingEmailColumnInCSVError = createError(
  'GPINVERR005',
  FAILURE_MESSAGES.INVITATION_CSV_MISSING_EMAIL_COLUMN,
  StatusCodes.BAD_REQUEST,
);

export const MissingGroupColumnInCSVError = createError(
  'GPINVERR006',
  FAILURE_MESSAGES.INVITATION_CSV_MISSING_GROUP_COLUMN,
  StatusCodes.BAD_REQUEST,
);

export const MissingEmailInRowError = createError(
  'GPINVERR007',
  FAILURE_MESSAGES.INVITATION_CSV_MISSING_EMAIL_IN_ROW,
  StatusCodes.BAD_REQUEST,
);

export const MissingGroupInRowError = createError(
  'GPINVERR008',
  FAILURE_MESSAGES.INVITATION_CSV_MISSING_GROUP_IN_ROW,
  StatusCodes.BAD_REQUEST,
);

export const NoFileProvidedForInvitations = createError(
  'GPINVERR011',
  FAILURE_MESSAGES.INVITATION_CSV_NO_FILE_PROVIDED,
  StatusCodes.BAD_REQUEST,
);

export const NoDataInFile = createError(
  'GPINVERR012',
  FAILURE_MESSAGES.INVITATION_CSV_NO_DATA_IN_FILE,
  StatusCodes.BAD_REQUEST,
);

export const CantCreateStructureInNoFolderItem = createError(
  'GPINVERR013',
  FAILURE_MESSAGES.INVITATION_CANNOT_CREATE_STRUCTURE_IN_NON_FOLDER_ITEM,
  StatusCodes.BAD_REQUEST,
);

export const TemplateItemDoesNotExist = createError(
  'GPINVERR014',
  FAILURE_MESSAGES.INVITATION_CSV_TEMPLATE_ITEM_DOES_NOT_EXIST,
  StatusCodes.BAD_REQUEST,
);

export const NoInvitationReceivedFound = createError(
  'GPINVERR015',
  FAILURE_MESSAGES.NO_INVITATION_RECEIVED,
  StatusCodes.BAD_REQUEST,
);
