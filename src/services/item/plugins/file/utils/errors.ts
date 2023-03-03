import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from './constants';

export const GraaspFileItemError = ErrorFactory(PLUGIN_NAME);

export class StorageExceeded extends GraaspFileItemError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR009',
        statusCode: StatusCodes.INSUFFICIENT_STORAGE,
        message: FAILURE_MESSAGES.STORAGE_EXCEEDED,
      },
      data,
    );
  }
}
export class UploadFileUnexpectedError extends GraaspFileItemError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR010',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        // TODO: change message
        message: FAILURE_MESSAGES.INVALID_UPLOAD_PARAMETERS,
      },
      data,
    );
  }
}

export class DownloadFileUnexpectedError extends GraaspFileItemError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR011',
        statusCode: StatusCodes.BAD_REQUEST,
        // TODO: change message
        message: FAILURE_MESSAGES.UPLOAD_EMPTY_FILE,
      },
      data,
    );
  }
}
