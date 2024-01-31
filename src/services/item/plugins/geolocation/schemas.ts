import { idParam } from '../../../../schemas/fluent-schema';

const geolocation = {
  type: 'object',
  properties: {
    id: { $ref: 'http://graasp.org/#/definitions/uuid' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    country: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    item: {
      $ref: 'http://graasp.org/items/#/definitions/item',
    },
  },
  required: ['lat', 'lng'],
};

export const getByItem = {
  params: idParam,
  response: {
    200: geolocation,
  },
};

export const getItemsInBox = {
  query: {
    type: 'object',
    properties: {
      lat1: { type: 'number' },
      lat2: { type: 'number' },
      lng1: { type: 'number' },
      lng2: { type: 'number' },
      search: { type: 'array', items: { type: 'string' } },
    },
    required: ['lat1', 'lat2', 'lng1', 'lng2'],
  },
  response: {
    200: {
      type: 'array',
      items: geolocation,
    },
  },
};

export const putGeolocation = {
  params: idParam,
  body: {
    type: 'object',
    properties: {
      geolocation: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: ['lat', 'lng'],
      },
    },
    required: ['geolocation'],
  },
};

export const deleteGeolocation = {
  params: idParam,
};
