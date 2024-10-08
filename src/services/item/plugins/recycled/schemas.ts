import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

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

export const packedRecycledItemSchemaRef = registerSchemaAsRef(
  'packedRecycledItem',
  'Packed Recycled Item',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: packedItemSchemaRef,
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

// schema for getting recycled items
export const getRecycledItemDatas = {
  response: {
    [StatusCodes.OK]: Type.Array(packedRecycledItemSchemaRef),
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
