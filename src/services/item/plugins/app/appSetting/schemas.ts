import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
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
      description: 'Settings saved for an app.',
      additionalProperties: false,
    },
  ),
);

export const create = {
  operationId: 'createAppSetting',
  tags: ['app', 'app-setting'],
  summary: 'Create a setting for an app',
  description: 'Create a setting in an app given data and name. Only admins can create settings.',

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
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  operationId: 'updateAppSetting',
  tags: ['app', 'app-setting'],
  summary: 'Update app setting',
  description: 'Update given app setting with new data. Only admins can update settings.',

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
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteAppSetting',
  tags: ['app', 'app-setting'],
  summary: 'Delete app setting',
  description: 'Delete given app setting.',

  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: appSettingSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  operationId: 'getAppSettingsForApp',
  tags: ['app', 'app-setting'],
  summary: 'Get all settings of an app',
  description: 'Get all settings saved for an app.',

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
    [StatusCodes.OK]: Type.Array(appSettingSchemaRef, { descritpion: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
