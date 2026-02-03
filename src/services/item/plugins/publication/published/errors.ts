import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory, PublishableItemTypeChecker } from '@graasp/sdk';

import { ItemType } from '../../../../../schemas/global';

export const GraaspPublishedError = ErrorFactory('graasp-plugin-published-item');

export const ItemPublishedNotFound = createError(
  'GPPIERR001',
  'Published Item Entry not found',
  StatusCodes.NOT_FOUND,
);

export class ItemTypeNotAllowedToPublish extends GraaspPublishedError {
  constructor(itemId: string, itemType: ItemType) {
    const allowedTypes = PublishableItemTypeChecker.getAllowedTypes();
    super(
      {
        code: 'GPPIERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `The type "${itemType}" of item "${itemId}" is not allowed to be published. Only these types are allowed: ${allowedTypes}.`,
      },
      {
        itemId,
        itemType,
      },
    );
  }
}

export class ItemPublicationAlreadyExists extends GraaspPublishedError {
  constructor(itemId: string) {
    super(
      {
        code: 'GPPIERR003',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `The item "${itemId}" is already published.`,
      },
      {
        itemId,
      },
    );
  }
}

export class ItemIsNotValidated extends GraaspPublishedError {
  constructor(itemId: string) {
    super(
      {
        code: 'GPPIERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `The item "${itemId}" must be validated before publishing it in the Libary.`,
      },
      {
        itemId,
      },
    );
  }
}
