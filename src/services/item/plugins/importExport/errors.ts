import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from './constants';

export const GraaspItemZipError = ErrorFactory(PLUGIN_NAME);

export class FileIsInvalidArchiveError extends GraaspItemZipError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIZERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_ARCHIVE_FILE,
      },
      data,
    );
  }
}

export class InvalidFileItemError extends GraaspItemZipError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIZERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_FILE_ITEM,
      },
      data,
    );
  }
}

export class UnexpectedExportError extends GraaspItemZipError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIZERR003',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: FAILURE_MESSAGES.UNEXPECTED_EXPORT_ERROR,
      },
      data,
    );
  }
}

export class InvalidItemTypeForDownloadError extends GraaspItemZipError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIZERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_ITEM_TYPE_FOR_DOWNLOAD,
      },
      data,
    );
  }
}

export class GraaspExportInvalidFileError extends GraaspItemZipError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIZERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.GRAASP_EXPORT_FILE_ERROR,
      },
      data,
    );
  }
}
