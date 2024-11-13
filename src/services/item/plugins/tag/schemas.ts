import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { TagCategory } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const tagSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: Type.String(),
    category: Type.Enum(TagCategory),
  },
  { description: 'Manual tag, representing a theme or subject' },
);

const tagSchemaRef = registerSchemaAsRef('tag', 'Tag', tagSchema);

export const getTagsForItem = {
  operationId: 'getTagsForItem',
  tags: ['tag'],
  summary: 'Get tags for item',
  description: `Get tags for item.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(tagSchemaRef),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const createTagForItem = {
  operationId: 'createTagForItem',
  tags: ['tag'],
  summary: 'Create tag for item',
  description: `Create tag for item. This tag can already exists in the list of tags, or be a new one to be added in the list.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: Type.Pick(tagSchema, ['name', 'category']),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
