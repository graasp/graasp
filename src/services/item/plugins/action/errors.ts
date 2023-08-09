import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-actions';

/**
 * Errors thrown by the chat tasks
 */

export const GraaspItemActionError = ErrorFactory(PLUGIN_NAME);

export class CannotPostAction extends GraaspItemActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GIAERR003',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Cannot post action',
      },
      data,
    );
  }
}
