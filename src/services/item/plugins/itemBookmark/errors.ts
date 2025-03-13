import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspBookmarkError = ErrorFactory('graasp-plugin-bookmark');

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
