import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

/**
 * Errors thrown by the item services
 */

export const WrongItemTypeError = createError(
  'GIERR001',
  'Item does not have the correct type',
  StatusCodes.BAD_REQUEST,
);

export const ItemOrderingError = createError<string>(
  'GIERR002',
  'Error while rescaling',
  StatusCodes.INTERNAL_SERVER_ERROR,
);
