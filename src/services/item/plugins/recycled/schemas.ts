import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MAX_TARGETS_FOR_MODIFY_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { ITEMS_PAGE_SIZE } from '../../constants';
import { itemSchemaRef } from '../../schemas';

export const recycledItemSchemaRef = registerSchemaAsRef(
  'recycledItemData',
  'Recycled Item Data',
  customType.StrictObject(
    {
      id: customType.UUID(),
      item: itemSchemaRef,
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      description: 'Instance representing a deleted item and its deleted descendants',
    },
  ),
);

export const getOwnRecycledItemDatas = {
  operationId: 'getOwnRecycledItemData',
  tags: ['recycled', 'item'],
  summary: 'Get own recycled item data',
  description: 'Get own recycled item data.',

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
      data: Type.Array(recycledItemSchemaRef),
      totalCount: Type.Number({
        minimum: 0,
      }),
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
