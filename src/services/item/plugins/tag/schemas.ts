import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { TagCategory } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const getTagsForItem = {
  operationId: 'getTagsForItem',
  tags: ['tag'],
  summary: 'Get tags for item',
  description: `Get tags for item.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(
      customType.StrictObject({
        id: customType.UUID(),
        name: Type.String(),
        category: Type.Enum(TagCategory),
      }),
    ),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
