import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

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
