import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants.js';

export const GraaspItemVisibilityError = ErrorFactory(PLUGIN_NAME);

export class ItemHasVisibility extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item already has visibility',
      },
      data,
    );
  }
}
export class ItemVisibilityNotFound extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR005',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item visibility not found',
      },
      data,
    );
  }
}
export class VisibilityNotFound extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      { code: 'GITERR006', statusCode: StatusCodes.NOT_FOUND, message: 'Visibility not found' },
      data,
    );
  }
}

export class CannotModifyParentVisibility extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR008',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Cannot modify inherited Visibility',
      },
      data,
    );
  }
}

export class ConflictingVisibilitiesInTheHierarchy extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR007',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Visibility already present in the hierarchy - itself or ancestors',
      },
      data,
    );
  }
}

export class InvalidUseOfItemVisibilityRepository extends GraaspItemVisibilityError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message:
          'ItemVisibilityRepository was not used correctly, this should not happen. Consider this an internal error. Contact your local developer team.',
      },
      data,
    );
  }
}
