import { idParam } from '../../../../schemas/fluent-schema';

const geolocation = {
  type: 'object',
  properties: {
    id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    lat: { type: 'number' },
    lng: { type: 'number' },
    country: { type: ['string', 'null'] },
    addressLabel: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    item: {
      $ref: 'https://graasp.org/items/#/definitions/item',
    },
  },
  required: ['lat', 'lng'],
  nullable: true,
};

export const getByItem = {
  params: idParam,
  response: {
    200: geolocation,
  },
};

const getItemsInBoxProps = {
  type: 'object',
  properties: {
    parentItemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    lat1: { type: 'number' },
    lat2: { type: 'number' },
    lng1: { type: 'number' },
    lng2: { type: 'number' },
    keywords: { type: 'array', items: { type: 'string' } },
  },
};

export const getItemsInBox = {
  query: {
    oneOf: [
      {
        ...getItemsInBoxProps,
        required: ['parentItemId'],
      },
      {
        ...getItemsInBoxProps,
        required: ['lat1', 'lat2', 'lng1', 'lng2'],
      },
    ],
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
          addressLabel: { type: 'string' },
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
