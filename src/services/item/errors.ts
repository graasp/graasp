import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, ItemTypeUnion } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item';

/**
 * Errors thrown by the item services
 */

export const GraaspItemError = ErrorFactory(PLUGIN_NAME);

export class WrongItemTypeError extends GraaspItemError {
  constructor(data?: ItemTypeUnion) {
    super(
      {
        code: 'GIERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item does not have the correct type',
      },
      data,
    );
  }
}
