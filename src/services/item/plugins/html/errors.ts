import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const HtmlItemNotFoundError = createError(
  'GPHTMLERR002',
  'Html item not found',
  StatusCodes.NOT_FOUND,
);

/**
 * Fallback error on unexpected internal error, opaque to avoid leaking information
 */
export const HtmlImportError = createError(
  'GPHTMLERR003',
  'Unexpected server error while importing Html',
  StatusCodes.INTERNAL_SERVER_ERROR,
);
