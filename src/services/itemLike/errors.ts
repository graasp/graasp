import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspItemLikeError = ErrorFactory('graasp-plugin-item-like');

export class ItemLikeNotFound extends GraaspItemLikeError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPILERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item Like not found',
      },
      data,
    );
  }
}
