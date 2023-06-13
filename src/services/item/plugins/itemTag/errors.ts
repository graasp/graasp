import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspItemTagsError = ErrorFactory(PLUGIN_NAME);

export class ItemHasTag extends GraaspItemTagsError {
  constructor(data?: unknown) {
    super(
      { code: 'GITERR004', statusCode: StatusCodes.BAD_REQUEST, message: 'Item already has tag' },
      data,
    );
  }
}
export class ItemTagNotFound extends GraaspItemTagsError {
  constructor(data?: unknown) {
    super(
      { code: 'GITERR005', statusCode: StatusCodes.NOT_FOUND, message: 'Item tag not found' },
      data,
    );
  }
}
export class TagNotFound extends GraaspItemTagsError {
  constructor(data?: unknown) {
    super({ code: 'GITERR006', statusCode: StatusCodes.NOT_FOUND, message: 'Tag not found' }, data);
  }
}

export class CannotModifyParentTag extends GraaspItemTagsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR008',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Cannot modify inherited tag',
      },
      data,
    );
  }
}

export class ConflictingTagsInTheHierarchy extends GraaspItemTagsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR007',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Tag already present in the hierarchy - itself or ancestors',
      },
      data,
    );
  }
}
