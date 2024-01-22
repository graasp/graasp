import { idParam } from '../../../../schemas/fluent-schema';

const geolocation = {
  type: 'object',
  properties: {
    id: { $ref: 'http://graasp.org/#/definitions/uuid' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    country: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    item: {
      $ref: 'http://graasp.org/items/#/definitions/item',
    },
  },
  required: ['lat', 'lng'],
};

export const getForItem = {
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
    },
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
      lat: { type: 'number' },
      lng: { type: 'number' },
    },
    required: ['lat', 'lng'],
  },
};

export const postItemWithGeolocation = {
  query: {
    id: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  body: {
    type: 'object',
    properties: {
      lat: { type: 'number' },
      lng: { type: 'number' },
    },
    required: ['lat', 'lng'],
  },
};

export const deleteGeolocation = {
  params: idParam,
};
