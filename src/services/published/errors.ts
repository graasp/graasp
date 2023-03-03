import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspItemLikeError = ErrorFactory('graasp-plugin-published-item');

export class ItemPublishedNotFound extends GraaspItemLikeError {
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
