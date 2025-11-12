import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspItemLikeError = ErrorFactory('graasp-plugin-item-like');

export const ItemLikeNotFound = createError(
  'GPILERR001',
  'Item Like not found',
  StatusCodes.NOT_FOUND,
);

export const CannotGetOthersLikes = createError(
  'GPILERR002',
  "You cannot get other members' likes",
  StatusCodes.NOT_FOUND,
);
