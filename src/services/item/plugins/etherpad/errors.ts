import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const EtherpadServerError = createError(
  'GPEPERR001',
  'Internal Etherpad server error',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const ItemMissingExtraError = createError(
  'GPEPERR003',
  'Item missing etherpad extra',
  StatusCodes.INTERNAL_SERVER_ERROR,
);
