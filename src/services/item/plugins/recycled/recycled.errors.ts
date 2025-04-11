import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspRecyledItemsError = ErrorFactory('graasp-plugin-recycled-items');

export class CannotRestoreNonDeletedItem extends GraaspRecyledItemsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPREIERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item is not recycled',
      },
      data,
    );
  }
}
