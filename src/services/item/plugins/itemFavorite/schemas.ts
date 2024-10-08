import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

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
  querystring: {
    type: 'object',
    properties: {
      memberId: customType.UUID(),
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: Type.Array(packedFavoriteSchemaRef),
  },
};

export const create = {
  params: {
    itemId: customType.UUID(),
  },
  response: {
    [StatusCodes.OK]: favoriteSchemaRef,
  },
};

export const deleteOne = {
  params: {
    itemId: customType.UUID(),
  },
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
};
