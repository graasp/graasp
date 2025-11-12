import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const UploadFileNotImageError = createError(
  'GPTERR001',
  FAILURE_MESSAGES.FILE_IS_NOT_IMAGE,
  StatusCodes.BAD_REQUEST,
);
