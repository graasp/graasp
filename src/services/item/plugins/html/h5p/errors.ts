import { StatusCodes } from 'http-status-codes';

import { GraaspHtmlError } from '../errors.js';

export class H5PInvalidFileError extends GraaspHtmlError {
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

export class H5PInvalidManifestError extends GraaspHtmlError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPH5PERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Invalid h5p.json manifest file',
      },
      data,
    );
  }
}
