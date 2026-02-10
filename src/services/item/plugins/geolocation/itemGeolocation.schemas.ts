import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { genericItemSchemaRef } from '../../common.schemas';
import { packedItemSchemaRef } from '../../item.schemas.packed';

export const geoCoordinateSchema = customType.StrictObject(
  {
    lat: Type.Number(),
    lng: Type.Number(),
  },
  { description: 'Geographic coordinates' },
);

export const geoCoordinateSchemaRef = registerSchemaAsRef(
  'geoCoordinate',
  'Geographic Coordinate',
  geoCoordinateSchema,
);

const geolocationMinimal = Type.Composite(
  [
    geoCoordinateSchema,
    customType.StrictObject({
      id: customType.UUID(),
      lat: Type.Number(),
      lng: Type.Number(),
      country: customType.Nullable(Type.String()),
      addressLabel: customType.Nullable(Type.String()),
    }),
  ],
  { additionalProperties: false },
);

const geolocation = customType.Nullable(
  Type.Composite(
    [
      geolocationMinimal,
      customType.StrictObject({
        helperLabel: customType.Nullable(Type.String()),
        createdAt: customType.DateTime(),
        updatedAt: customType.DateTime(),
        item: genericItemSchemaRef,
      }),
    ],
    { additionalProperties: false },
  ),
);

const geolocationPacked = Type.Composite([
  geolocation,
  customType.StrictObject({
    item: packedItemSchemaRef,
  }),
]);

export const getByItem = {
  operationId: 'getGeolocationByItem',
  tags: ['map'],
  summary: 'Get the geolocation info of the given item',
  description:
    'Get the geolocation info of the given item, alongside the complete information about the item.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(geolocationPacked),
    '4xx': errorSchemaRef,
  },
};

const getItemsInBoxProps = customType.StrictObject({
  parentItemId: customType.UUID(),
  lat1: Type.Number(),
  lat2: Type.Number(),
  lng1: Type.Number(),
  lng2: Type.Number(),
  keywords: Type.Array(Type.String()),
});

export const getItemsInBox = {
  operationId: 'getItemsInBox',
  tags: ['item', 'map'],
  summary: 'Get items within a box defined by geographic coordinates',
  description:
    'Get accessible items within a box defined by geographic coordinates, within a parent if given.',

  // Querystring is at least `parentItemId` or `lat1`, `lat2`, `lng1`, `lng2`. We can still use other properties since we respect one of the requirement.
  // `keywords` are optional
  querystring: Type.Union([
    Type.Composite(
      [
        Type.Pick(getItemsInBoxProps, ['parentItemId']), // We pick `parentItemId` to make it required
        Type.Partial(Type.Omit(getItemsInBoxProps, ['parentItemId'])), // Other properties are optional
      ],
      {
        additionalProperties: false,
      },
    ),
    Type.Composite(
      [
        Type.Pick(getItemsInBoxProps, ['lat1', 'lat2', 'lng1', 'lng2']), // We pick `lat1`, `lat2`, `lng1`, `lng2` to make them required
        Type.Partial(Type.Omit(getItemsInBoxProps, ['lat1', 'lat2', 'lng1', 'lng2'])), // Other properties are optional
      ],
      {
        additionalProperties: false,
      },
    ),
  ]),
  response: {
    [StatusCodes.OK]: Type.Array(geolocationPacked),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const putGeolocation = {
  operationId: 'putGeolocation',
  tags: ['map'],
  summary: 'Set a geolocation on an item',
  description: 'Set a geolocation on an item.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    geolocation: customType.StrictObject({
      lat: Type.Number(),
      lng: Type.Number(),
      addressLabel: Type.Optional(Type.String()),
      helperLabel: Type.Optional(Type.String()),
    }),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteGeolocation = {
  operationId: 'deleteGeolocation',
  tags: ['map'],
  summary: 'Remove a geolocation for an item',
  description: 'Remove a geolocation for an item.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const geolocationReverse = {
  operationId: 'geolocationReverse',
  tags: ['map'],
  summary: 'Get address information of given geographic coordinates',
  description:
    'Get address information of given geographic coordinates. This endpoint is using a third-party API.',

  querystring: customType.StrictObject({
    lat: Type.Number(),
    lng: Type.Number(),
    lang: Type.Optional(Type.String()),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      addressLabel: Type.String(),
      country: Type.String(),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const geolocationSearch = {
  operationId: 'geolocationSearch',
  tags: ['map'],
  summary: 'Get geographic information from a string',
  description:
    'Get geographic information from a string. This endpoint is using a third-party API.',

  querystring: customType.StrictObject({
    query: Type.String(),
    lang: Type.Optional(Type.String()),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(geolocationMinimal),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
