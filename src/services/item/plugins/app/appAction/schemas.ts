import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { accountSchemaRef } from '../../../../account/schemas';
import { itemIdSchemaRef } from '../../itemLike/schemas';

export const appActionSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      account: accountSchemaRef,
      member: Type.Ref(accountSchemaRef.$ref, { deprecated: true }),
      data: Type.Object({}, { additionalProperties: true }),
      type: Type.String(),
      createdAt: customType.DateTime(),
    },
    {
      // Schema Options
      title: 'App Action',
      $id: 'appAction',
      additionalProperties: false,
    },
  ),
);

export const create = {
  params: itemIdSchemaRef,
  body: Type.Object({
    data: Type.Object({}, { additionalProperties: true }),
    type: Type.String({ minLength: 3, maxLength: 25 }),
  }),
  response: {
    [StatusCodes.OK]: appActionSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  params: itemIdSchemaRef,
  querystring: Type.Union([
    Type.Object(
      {
        memberId: customType.UUID(),
      },
      { additionalProperties: false, deprecated: true },
    ),
    Type.Object(
      {
        accountId: customType.UUID(),
      },
      { additionalProperties: false },
    ),
    Type.Object({}, { additionalProperties: false }),
  ]),
  response: {
    [StatusCodes.OK]: Type.Array(appActionSchemaRef),
  },
} as const satisfies FastifySchema;
