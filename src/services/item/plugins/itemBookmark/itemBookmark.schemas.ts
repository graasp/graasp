import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { packedItemSchemaRef } from '../../item.schemas.packed';

const packedBookmarkSchema = customType.StrictObject(
  {
    // Object definition
    id: customType.UUID(),
    item: packedItemSchemaRef,
    createdAt: customType.DateTime(),
  },
  {
    description: 'Bookmark instance for member of a given packed item.',
  },
);

const packedBookmarkSchemaRef = registerSchemaAsRef(
  'packedBookmark',
  'Packed Bookmark',
  packedBookmarkSchema,
);

export const getOwnBookmark = {
  operationId: 'getOwnBookmark',
  tags: ['favorite'],
  summary: 'Get all bookmarked instances of the current member',
  description: 'Get all bookmarked instances of the current member',

  response: {
    [StatusCodes.OK]: Type.Array(packedBookmarkSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const create = {
  operationId: 'createBookmark',
  tags: ['favorite'],
  summary: 'Bookmark item',
  description: 'Bookmark item',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteBookmark',
  tags: ['favorite'],
  summary: 'Remove item from bookmarks',
  description: 'Remove item from bookmarks',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
