import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspEtherpadError = ErrorFactory(PLUGIN_NAME);

export class EtherpadServerError extends GraaspEtherpadError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPEPERR001',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal Etherpad server error',
      },
      data,
    );
  }
}

export class ItemMissingExtraError extends GraaspEtherpadError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPEPERR003',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Item missing etherpad extra',
      },
      data,
    );
  }
}
