import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspCategoriesError = ErrorFactory('graasp-plugin-categories');

export class DuplicateItemCategoryError extends GraaspCategoriesError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPCATERR001',
        statusCode: StatusCodes.CONFLICT,
        message: 'This item already has this item',
      },
      data,
    );
  }
}

export class CategoryNotFound extends GraaspCategoriesError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPCATERR002',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Category not found',
      },
      data,
    );
  }
}
