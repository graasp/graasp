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

export class MissingGeolocationSearchParams extends GraaspItemGeolocationError {
  constructor(data?) {
    super(
      {
        code: 'GIGEOERR003',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Geolocation Search should include parent item, or all lat1, lat2, lng1 and lng2',
      },
      data,
    );
  }
}

export class MissingGeolocationApiKey extends GraaspItemGeolocationError {
  constructor(data?) {
    super(
      {
        code: 'GIGEOERR004',
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
        message: 'Geolocation API key is not defined',
      },
      data,
    );
  }
}
