import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const CannotWriteFileError = createError(
  'GPAERR001',
  'A file was not created properly for the requested archive',
  StatusCodes.NOT_FOUND,
);
