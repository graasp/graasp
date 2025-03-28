import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../../member/member.schemas';

export const appSettingSchemaRef = registerSchemaAsRef(
  'appSetting',
  'App Setting',
  customType.StrictObject(
    {
      id: customType.UUID(),
      name: Type.String(),
      data: Type.Object({}, { additionalProperties: true }),
      creator: Type.Optional(nullableMemberSchemaRef),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      description: 'Settings for an app.',
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
  body: customType.StrictObject({
    data: Type.Object({}),
    name: Type.String(),
  }),
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
  body: customType.StrictObject({
    data: Type.Object({}),
  }),
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
    [StatusCodes.OK]: customType.UUID({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  operationId: 'getAppSettingsForApp',
  tags: ['app', 'app-setting'],
  summary: 'Get all settings of an app',
  description: 'Get all settings for an app.',

  params: Type.Object({
    itemId: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    name: Type.Optional(
      Type.String({ description: 'Return only app settings that match the given name' }),
    ),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(appSettingSchemaRef, { descritpion: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
