import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const FileIsInvalidArchiveError = createError(
  'GPIZERR001',
  FAILURE_MESSAGES.INVALID_ARCHIVE_FILE,
  StatusCodes.BAD_REQUEST,
);

export const InvalidFileItemError = createError(
  'GPIZERR002',
  FAILURE_MESSAGES.INVALID_FILE_ITEM,
  StatusCodes.BAD_REQUEST,
);

export const UnexpectedExportError = createError(
  'GPIZERR003',
  FAILURE_MESSAGES.UNEXPECTED_EXPORT_ERROR,
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const InvalidItemTypeForDownloadError = createError(
  'GPIZERR004',
  FAILURE_MESSAGES.INVALID_ITEM_TYPE_FOR_DOWNLOAD,
  StatusCodes.BAD_REQUEST,
);

export const GraaspExportInvalidFileError = createError(
  'GPIZERR005',
  FAILURE_MESSAGES.GRAASP_EXPORT_FILE_ERROR,
  StatusCodes.BAD_REQUEST,
);
