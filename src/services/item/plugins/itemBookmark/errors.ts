import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspBookmarkError = ErrorFactory('graasp-plugin-bookmark');

export class DuplicateBookmarkError extends GraaspBookmarkError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPCATERR001',
        statusCode: StatusCodes.CONFLICT,
        message: 'This item is already bookmarked',
      },
      data,
    );
  }
}

export class ItemBookmarkNotFound extends GraaspBookmarkError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPCATERR002',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'bookmark not found',
      },
      data,
    );
  }
}
