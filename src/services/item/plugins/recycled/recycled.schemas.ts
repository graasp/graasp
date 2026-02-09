import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { MAX_TARGETS_FOR_MODIFY_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { genericItemSchemaRef } from '../../common.schemas';
import { ITEMS_PAGE_SIZE } from '../../constants';

export const recycledItemSchemaRef = registerSchemaAsRef(
  'recycledItemData',
  'Recycled Item Data',
  customType.StrictObject(
    {
      id: customType.UUID(),
      item: genericItemSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      description:
        "Instance representing a deleted item and its deleted descendants. A recycled item is not permanently deleted, it's still possible to recover it.",
    },
  ),
);

export const getOwnRecycledItems = {
  operationId: 'getOwnRecycledItems',
  tags: ['recycled', 'item'],
  summary: 'Get own recycled items',
  description: 'Get own recycled items.',

  querystring: Type.Optional(
    customType.Pagination({
      page: {
        minimum: 0,
        default: 1,
      },
      pageSize: { minimum: 1, default: ITEMS_PAGE_SIZE },
    }),
  ),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      data: Type.Array(genericItemSchemaRef),
      pagination: customType.Pagination({
        page: {
          minimum: 0,
          default: 1,
        },
        pageSize: { minimum: 1, default: ITEMS_PAGE_SIZE },
      }),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const recycleMany = {
  operationId: 'recycleManyItems',
  tags: ['recycled', 'item'],
  summary: 'Recycle many items',
  description: 'Recycle many items. This will create as many recycled item data.',

  querystring: Type.Object({
    id: Type.Array(customType.UUID(), {
      uniqueItems: true,
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
    }),
  }),

  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const restoreMany = {
  operationId: 'restoreManyItems',
  tags: ['recycled', 'item'],
  summary: 'Restore many items',
  description: 'Restore many items. This will delete as many recycled item data.',

  querystring: Type.Object({
    id: Type.Array(customType.UUID(), {
      uniqueItems: true,
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
    }),
  }),

  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
