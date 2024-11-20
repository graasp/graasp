import { Static, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { TagCategory } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';

const tagSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: Type.String(),
    category: Type.Enum(TagCategory),
  },
  { description: 'User provided tag, representing a theme or subject' },
);

export const tagSchemaRef = registerSchemaAsRef('tag', 'Tag', tagSchema);

export const tagCount = customType.StrictObject(
  {
    name: Type.String(),
    category: Type.Enum(TagCategory),
    count: Type.Number(),
  },
  { description: 'Successful Response' },
);

export type TagCount = Static<typeof tagCount>;

export const getCountForTags = {
  operationId: 'getCountForTags',
  tags: ['tag'],
  summary: 'Get count for tags',
  description: `Get how many times a tag is associated with items, filtered by string search. It can be filtered by category.`,

  querystring: customType.StrictObject({
    search: Type.String({ minLength: 1 }),
    category: Type.Optional(Type.Enum(TagCategory)),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(tagCount),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
