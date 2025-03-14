import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from '../constants.js';

export const GraaspAppActionError = ErrorFactory(PLUGIN_NAME + '/app-action');

export class AppActionNotAccessible extends GraaspAppActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR006',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.APP_ACTION_NOT_ACCESSIBLE,
      },
      data,
    );
  }
}
