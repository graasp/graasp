import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from '../../../../thumbnail/constants';

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
