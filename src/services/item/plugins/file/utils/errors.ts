import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspFileItemError = ErrorFactory(PLUGIN_NAME);

export const StorageExceeded = createError(
  'GPFERR009',
  FAILURE_MESSAGES.STORAGE_EXCEEDED,
  StatusCodes.INSUFFICIENT_STORAGE,
);
