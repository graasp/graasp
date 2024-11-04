import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-tags';

/**
 * Errors thrown by the chat tasks
 */

export const GraaspTagsError = ErrorFactory(PLUGIN_NAME);

export class ItemTagAlreadyExists extends GraaspTagsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GITERR001',
        statusCode: StatusCodes.CONFLICT,
        message: 'This item already has this tag',
      },
      data,
    );
  }
}
