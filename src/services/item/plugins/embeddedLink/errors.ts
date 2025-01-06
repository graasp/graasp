import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-embedded-link';

export const GraaspError = ErrorFactory(PLUGIN_NAME);

export class InvalidUrl extends GraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPIELERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `The URL is not valid.`,
      },
      data,
    );
  }
}
