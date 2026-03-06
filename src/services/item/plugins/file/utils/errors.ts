import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

 
export const StorageExceeded = createError(
  'GPFERR009',
  FAILURE_MESSAGES.STORAGE_EXCEEDED,
  StatusCodes.INSUFFICIENT_STORAGE,
);
