import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

export const GraaspHtmlError = ErrorFactory('graasp-plugin-html');

export class HtmlItemNotFoundError extends GraaspHtmlError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPHTMLERR002',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Html item not found',
      },
      data,
    );
  }
}

/**
 * Fallback error on unexpected internal error, opaque to avoid leaking information
 */
export class HtmlImportError extends GraaspHtmlError {
  constructor() {
    super({
      code: 'GPHTMLERR003',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Unexpected server error while importing Html',
    });
  }
}
