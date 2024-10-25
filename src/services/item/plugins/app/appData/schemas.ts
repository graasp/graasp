import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { accountSchemaRef, nullableAccountSchemaRef } from '../../../../account/schemas';
import { itemSchemaRef } from '../../../schemas';

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
      description: 'User data saved for an app.',
      additionalProperties: false,
    },
  ),
);

export const create = {
  operationId: 'createAppData',
  tags: ['app', 'app-data'],
  summary: 'Create a user data for an app',
  description: 'Create a user data in an app given data and type.',

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
    '4xx': errorSchemaRef,
  },
};

export const updateOne = {
  operationId: 'updateAppData',
  tags: ['app', 'app-data'],
  summary: 'Update app data',
  description: 'Update given app data with new data.',

  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  body: Type.Object({
    data: Type.Object({}, { additionalProperties: true }),
  }),
  response: {
    [StatusCodes.OK]: appDataSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteAppData',
  tags: ['app', 'app-data'],
  summary: 'Delete app data',
  description: 'Delete given app data.',

  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.UUID({ descritpion: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  operationId: 'getAppDataForApp',
  tags: ['app', 'app-data'],
  summary: 'Get all app data of an app',
  description:
    'Get app data saved for an app, depending on the permission of the user and the data visibility.',

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
    [StatusCodes.OK]: Type.Array(appDataSchemaRef, { descritpion: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
