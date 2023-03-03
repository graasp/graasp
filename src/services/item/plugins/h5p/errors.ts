import { ErrorFactory } from '@graasp/sdk';
import { StatusCodes } from 'http-status-codes';

import { PLUGIN_NAME } from './constants';

export const GraaspH5PError = ErrorFactory(PLUGIN_NAME);

export class InvalidH5PFileError extends GraaspH5PError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPH5PERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'File is not a valid H5P package',
      },
      data,
    );
  }
}

export class H5PItemNotFoundError extends GraaspH5PError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPH5PERR002',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'H5P item not found',
      },
      data,
    );
  }
}

export class H5PItemMissingExtraError extends GraaspH5PError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPH5PERR003',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'H5P item missing required extra',
      },
      data,
    );
  }
}

export class H5PImportError extends GraaspH5PError {
  constructor() {
    super({
      code: 'GPH5PERR004',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Unexpected server error while importing H5P',
    });
  }
}
