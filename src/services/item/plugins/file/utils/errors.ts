import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from './constants.js';

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
