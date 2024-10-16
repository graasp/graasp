import { TRef, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { ITEMS_PAGE_SIZE } from '../../constants';
import { itemSchemaRef, packedItemSchemaRef } from '../../schemas';

export const recycledItemSchemaRef = registerSchemaAsRef(
  'recycledItem',
  'Recycled Item',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: itemSchemaRef,
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const buildPaginatedSchemaRef = (entity: TRef) =>
  Type.Object(
    {
      data: Type.Array(entity),
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
    },
    {
      additionalProperties: false,
    },
  );

// schema for getting own recycled items
export const getOwnRecycledItemDatas = {
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
    [StatusCodes.OK]: buildPaginatedSchemaRef(recycledItemSchemaRef),
  },
} as const satisfies FastifySchema;

// schema for deleting one item
export const deleteOne = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: recycledItemSchemaRef,
  },
} as const satisfies FastifySchema;

export const recycleMany = (maxItems: number) =>
  ({
    querystring: Type.Object({
      id: Type.Array(customType.UUID(), { uniqueItems: true, maxItems }),
    }),
    response: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      [StatusCodes.ACCEPTED]: Type.Array(customType.UUID()),
    },
  }) as const satisfies FastifySchema;

export const recycleOrRestoreMany = {
  querystring: Type.Object({
    id: Type.Array(customType.UUID(), {
      uniqueItems: true,
      maxItems: MAX_TARGETS_FOR_READ_REQUEST,
    }),
  }),

  response: {
    // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID()),
  },
} as const satisfies FastifySchema;
