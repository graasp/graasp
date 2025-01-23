import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef } from '../../schemas';
import { packedItemSchemaRef } from '../../schemas.packed';

const favoriteSchemaRef = registerSchemaAsRef(
  'favorite',
  'Favorite',
  customType.StrictObject(
    {
      id: customType.UUID(),
      item: itemSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      description: 'Bookmark instance for member of a given item.',
    },
  ),
);

const packedFavoriteSchemaRef = registerSchemaAsRef(
  'packedFavorite',
  'Packed Favorite',
  customType.StrictObject(
    {
      // Object definition
      id: customType.UUID(),
      item: packedItemSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      description: 'Bookmark instance for member of a given packed item.',
    },
  ),
);

export const getOwnFavorite = {
  operationId: 'getOwnFavorite',
  tags: ['favorite'],
  summary: 'Get all bookmarked instances of the current member',
  description: 'Get all bookmarked instances of the current member',

  response: {
    [StatusCodes.OK]: Type.Array(packedFavoriteSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const create = {
  operationId: 'createFavorite',
  tags: ['favorite'],
  summary: 'Bookmark item',
  description: 'Bookmark item',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: favoriteSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteFavorite',
  tags: ['favorite'],
  summary: 'Remove item from bookmarks',
  description: 'Remove item from bookmarks',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.UUID({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
