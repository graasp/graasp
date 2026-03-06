import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const DuplicateBookmarkError = createError(
  'GPCATERR001',
  'This item is already bookmarked',
  StatusCodes.CONFLICT,
);

export const ItemBookmarkNotFound = createError(
  'GPCATERR002',
  'bookmark not found',
  StatusCodes.NOT_FOUND,
);
