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
    anyOf: [
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

export const geolocationReverse = {
  querystring: {
    type: 'object',
    properties: {
      lat: { type: 'number' },
      lng: { type: 'number' },
      lang: { type: 'string' },
    },
    required: ['lat', 'lng'],
  },

  response: {
    200: {
      type: 'object',
      properties: {
        addressLabel: { type: 'string' },
        country: { type: 'string' },
      },
    },
  },
};

export const geolocationSearch = {
  querystring: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      lang: { type: 'string' },
    },
    required: ['query'],
  },

  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          addressLabel: { type: 'string' },
          country: { type: 'string' },
          id: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
      },
    },
  },
};
