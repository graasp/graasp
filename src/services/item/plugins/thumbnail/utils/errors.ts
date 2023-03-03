import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from './constants';

const ThumbnailError = ErrorFactory(PLUGIN_NAME);

export class UploadFileNotImageError extends ThumbnailError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPTERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.FILE_IS_NOT_IMAGE,
      },
      data,
    );
  }
}

export class UndefinedItemError extends ThumbnailError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPTERR002',
        statusCode: StatusCodes.METHOD_NOT_ALLOWED,
        message: FAILURE_MESSAGES.FILE_IS_NOT_IMAGE,
      },
      data,
    );
  }
}
