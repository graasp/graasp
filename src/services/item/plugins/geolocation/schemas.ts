import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

const geolocationMinimal = Type.Object(
  {
    id: customType.UUID(),
    lat: Type.Number(),
    lng: Type.Number(),
    country: customType.Nullable(Type.String()),
    addressLabel: customType.Nullable(Type.String()),
  },
  { additionalProperties: false },
);

const geolocation = customType.Nullable(
  Type.Composite(
    [
      geolocationMinimal,
      Type.Object(
        {
          helperLabel: customType.Nullable(Type.String()),
          createdAt: customType.DateTime(),
          updatedAt: customType.DateTime(),
          item: itemSchemaRef,
        },
        { additionalProperties: false },
      ),
    ],
    { additionalProperties: false },
  ),
);

const geolocationPacked = Type.Composite([
  geolocation,
  Type.Object(
    {
      item: packedItemSchemaRef,
    },
    { additionalProperties: false },
  ),
]);

export const getByItem = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: customType.Nullable(geolocationPacked),
  },
};

const getItemsInBoxProps = Type.Object(
  {
    parentItemId: customType.UUID(),
    lat1: Type.Number(),
    lat2: Type.Number(),
    lng1: Type.Number(),
    lng2: Type.Number(),
    keywords: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const getItemsInBox = {
  querystring: Type.Union([
    Type.Composite(
      [
        Type.Pick(getItemsInBoxProps, ['parentItemId']),
        Type.Partial(Type.Omit(getItemsInBoxProps, ['parentItemId'])),
      ],
      {
        additionalProperties: false,
      },
    ),
    Type.Composite(
      [
        Type.Pick(getItemsInBoxProps, ['lat1', 'lat2', 'lng1', 'lng2']),
        Type.Partial(Type.Omit(getItemsInBoxProps, ['lat1', 'lat2', 'lng1', 'lng2'])),
      ],
      {
        additionalProperties: false,
      },
    ),
  ]),
  response: {
    [StatusCodes.OK]: Type.Array(geolocationPacked),
  },
} as const satisfies FastifySchema;

export const putGeolocation = {
  params: entityIdSchemaRef,
  body: Type.Object(
    {
      geolocation: Type.Object(
        {
          lat: Type.Number(),
          lng: Type.Number(),
          addressLabel: Type.Optional(Type.String()),
          helperLabel: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

export const deleteGeolocation = {
  params: entityIdSchemaRef,
} as const satisfies FastifySchema;

export const geolocationReverse = {
  querystring: Type.Object(
    {
      lat: Type.Number(),
      lng: Type.Number(),
      lang: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        addressLabel: Type.String(),
        country: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
} as const satisfies FastifySchema;

export const geolocationSearch = {
  querystring: Type.Object(
    {
      query: Type.String(),
      lang: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Array(geolocationMinimal),
  },
} as const satisfies FastifySchema;
