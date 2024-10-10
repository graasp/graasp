import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef, packedItemSchemaRef } from '../../schema';

export const favoriteSchemaRef = registerSchemaAsRef(
  'favorite',
  'Favorite',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: itemSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const packedFavoriteSchemaRef = registerSchemaAsRef(
  'packedFavorite',
  'Packed Favorite',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: packedItemSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const getFavorite = {
  querystring: Type.Partial(
    Type.Object(
      {
        memberId: customType.UUID(),
      },
      {
        additionalProperties: false,
      },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedFavoriteSchemaRef),
  },
} as const satisfies FastifySchema;

export const create = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: favoriteSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
} as const satisfies FastifySchema;
