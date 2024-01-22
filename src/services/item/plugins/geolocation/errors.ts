import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-geolocation';

/**
 * Errors thrown by the chat tasks
 */

export const GraaspItemGeolocationError = ErrorFactory(PLUGIN_NAME);

export class ItemGeolocationNotFound extends GraaspItemGeolocationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GIGEOERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Geolocation not found',
      },
      data,
    );
  }
}
