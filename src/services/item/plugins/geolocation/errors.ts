import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-geolocation';

/**
 * Errors thrown by item geolocation
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

export class PartialItemGeolocation extends GraaspItemGeolocationError {
  constructor(data?: { lat?: unknown; lng?: unknown }) {
    super(
      {
        code: 'GIGEOERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Geolocation should have both lat and lng',
      },
      data,
    );
  }
}
