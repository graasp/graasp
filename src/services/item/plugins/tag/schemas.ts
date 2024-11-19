import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { TAG_NAME_MAX_LENGTH, TAG_NAME_PATTERN, TagCategory } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { tagSchemaRef } from '../../../tag/schemas';

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
  description: `Create tag for the item. The tag will be associated with the given item. If the tag does not already exist in the common list of tags, it will be added and other users will see it in their suggestions.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({
    name: Type.String({
      minLength: 1,
      maxLength: TAG_NAME_MAX_LENGTH,
      pattern: TAG_NAME_PATTERN.toString().slice(1, -1),
    }),
    category: Type.Enum(TagCategory),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteTagForItem = {
  operationId: 'deleteTagForItem',
  tags: ['tag'],
  summary: 'Delete tag associated with item',
  description:
    'Delete tag associated with item. It does not throw if the specified tag is not originally associated with the item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    tagId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
