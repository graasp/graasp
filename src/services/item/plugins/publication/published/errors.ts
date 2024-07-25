import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, ItemTypeUnion, PublishableItemTypeChecker } from '@graasp/sdk';

export const GraaspPublishedError = ErrorFactory('graasp-plugin-published-item');

export class ItemPublishedNotFound extends GraaspPublishedError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPPIERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Published Item Entry not found',
      },
      data,
    );
  }
}

export class ItemTypeNotAllowedToPublish extends GraaspPublishedError {
  constructor(itemId: string, itemType: ItemTypeUnion) {
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
