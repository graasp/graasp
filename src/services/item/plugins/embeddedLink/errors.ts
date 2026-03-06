import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const InvalidUrl = createError(
  'GPIELERR002',
  `The URL is not valid.`,
  StatusCodes.BAD_REQUEST,
);
