import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item';

/**
 * Errors thrown by the item services
 */

export const GraaspItemError = ErrorFactory(PLUGIN_NAME);

export const WrongItemTypeError = createError(
  'GIERR001',
  'Item does not have the correct type',
  StatusCodes.BAD_REQUEST,
);

export class ItemOrderingError extends GraaspItemError {
  constructor(reason?: string) {
    super(
      {
        code: 'GIERR002',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Error while rescaling',
      },
      reason,
    );
  }
}
