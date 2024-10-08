import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { accountSchemaRef, nullableAccountSchemaRef } from '../../../../account/schemas';
import { itemSchemaRef } from '../../../schema';

export const appDataSchemaRef = registerSchemaAsRef(
  'appData',
  'App Data',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      account: accountSchemaRef,
      member: Type.Ref(accountSchemaRef.$ref, { deprecated: true }),
      item: itemSchemaRef,
      data: Type.Object({}, { additionalProperties: true }),
      type: Type.String(),
      visibility: Type.String({ enum: ['member', 'item'] }),
      creator: nullableAccountSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const create = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  body: {
    type: 'object',
    required: ['data', 'type'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      type: { type: 'string', minLength: 3, maxLength: 25 },
      visibility: { type: 'string', enum: ['member', 'item'] },
      /** @deprecated use accountId */
      memberId: customType.UUID({ deprecated: true }),
      accountId: customType.UUID(),
    },
  },
  response: {
    [StatusCodes.OK]: appDataSchemaRef,
  },
};

export const updateOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  body: Type.Object({
    data: Type.Object({}, { additionalProperties: true }),
  }),
  response: {
    [StatusCodes.OK]: appDataSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
} as const satisfies FastifySchema;

export const getForOne = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: Type.Array(appDataSchemaRef),
  },
} as const satisfies FastifySchema;
