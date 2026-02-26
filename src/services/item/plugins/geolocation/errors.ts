import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const ItemGeolocationNotFound = createError(
  'GIGEOERR001',
  'Geolocation not found',
  StatusCodes.NOT_FOUND,
);

export const PartialItemGeolocation = createError(
  'GIGEOERR002',
  'Geolocation should have both lat and lng',
  StatusCodes.BAD_REQUEST,
);

export const MissingGeolocationSearchParams = createError(
  'GIGEOERR003',
  'Geolocation Search should include parent item, or all lat1, lat2, lng1 and lng2',
  StatusCodes.BAD_REQUEST,
);

export const MissingGeolocationApiKey = createError(
  'GIGEOERR004',
  'Geolocation API key is not defined',
  StatusCodes.SERVICE_UNAVAILABLE,
);
