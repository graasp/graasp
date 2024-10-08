import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';
import { idParam } from '../../../../schemas/fluent-schema';
import { entityIdSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

const geolocation = {
  type: 'object',
  properties: {
    id: customType.UUID(),
    lat: { type: 'number' },
    lng: { type: 'number' },
    country: { type: ['string', 'null'] },
    addressLabel: { type: ['string', 'null'] },
    helperLabel: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    item: itemSchemaRef,
  },
  required: ['lat', 'lng'],
  nullable: true,
};

const geolocationPacked = {
  ...geolocation,
  properties: {
    ...geolocation.properties,
    item: packedItemSchemaRef,
  },
};

export const getByItem = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: geolocationPacked,
  },
};

const getItemsInBoxProps = {
  type: 'object',
  properties: {
    parentItemId: customType.UUID(),
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
      items: geolocationPacked,
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
          helperLabel: { type: 'string' },
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
      items: geolocation,
    },
  },
};
