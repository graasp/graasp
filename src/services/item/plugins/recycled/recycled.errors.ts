import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const CannotRestoreNonDeletedItem = createError(
  'GPREIERR001',
  'Item is not recycled',
  StatusCodes.BAD_REQUEST,
);
