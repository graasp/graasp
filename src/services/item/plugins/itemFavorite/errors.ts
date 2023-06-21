import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspFavoriteError = ErrorFactory('graasp-plugin-favorite');

export class DuplicateFavoriteError extends GraaspFavoriteError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPCATERR001',
        statusCode: StatusCodes.CONFLICT,
        message: 'This item is already favorite',
      },
      data,
    );
  }
}
