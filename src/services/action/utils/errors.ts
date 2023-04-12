import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from '../constants/constants';

export const GraaspActionError = ErrorFactory(PLUGIN_NAME);
export class CannotWriteFileError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'A file was not created properly for the requested archive',
      },
      data,
    );
  }
}
