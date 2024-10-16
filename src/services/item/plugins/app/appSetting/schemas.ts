import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { nullableMemberSchemaRef } from '../../../../member/schemas';
import { itemSchemaRef } from '../../../schemas';

export const appSettingSchemaRef = registerSchemaAsRef(
  'appSetting',
  'App Setting',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      name: Type.String(),
      item: itemSchemaRef,
      data: Type.Object({}, { additionalProperties: true }),
      creator: nullableMemberSchemaRef,
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
    required: ['data', 'name'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      name: { type: 'string' },
    },
  },
  response: {
    [StatusCodes.OK]: appSettingSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  body: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    [StatusCodes.OK]: appSettingSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: appSettingSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  querystring: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: Type.Array(appSettingSchemaRef),
  },
} as const satisfies FastifySchema;
