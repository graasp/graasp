import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';



export const ItemPublishedNotFound = createError(
  'GPPIERR001',
  'Published Item Entry not found',
  StatusCodes.NOT_FOUND,
);

export const ItemTypeNotAllowedToPublish = createError(
  'GPPIERR002',
  'Item type not allowed to publish',
  StatusCodes.BAD_REQUEST,
);

export const ItemPublicationAlreadyExists = createError(
  'GPPIERR003',
  'Item is already published',
  StatusCodes.BAD_REQUEST,
);

export const ItemIsNotValidated = createError(
  'GPPIERR004',
  'Item must be validated before publishing',
  StatusCodes.BAD_REQUEST,
);
