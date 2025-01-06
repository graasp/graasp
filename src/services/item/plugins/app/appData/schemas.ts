import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { AppDataVisibility } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { accountSchemaRef, nullableAccountSchemaRef } from '../../../../account/schemas';
import { itemSchemaRef } from '../../../schemas';

const appDataSchema = customType.StrictObject(
  {
    // Object Definition
    id: customType.UUID(),
    account: accountSchemaRef,
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
  },
);

export const appDataSchemaRef = registerSchemaAsRef('appData', 'App Data', appDataSchema);

export const appDataWithLegacyPropsSchemaRef = registerSchemaAsRef(
  'appDataWithLegacyProps',
  'App Data (legacy)',
  Type.Composite(
    [
      appDataSchema,
      Type.Object({
        member: Type.Ref(accountSchemaRef.$ref, {
          deprecated: true,
          description:
            'Legacy property provided for convenience. Please migrate to using the `account` prop instead.',
        }),
      }),
    ],
    {
      additionalProperties: false,
      description:
        'App Data with support for returning legacy properties for older implementations of the apps API. Returns a copy of the `account` property as the `member` property.',
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
  body: customType.StrictObject({
    data: Type.Object({}),
    type: Type.String({ minLength: 3, maxLength: 25 }),
    visibility: Type.Optional(Type.Enum(AppDataVisibility)),
    /** @deprecated use accountId */
    memberId: Type.Optional(customType.UUID({ deprecated: true })),
    accountId: Type.Optional(customType.UUID()),
  }),
  response: {
    [StatusCodes.OK]: appDataWithLegacyPropsSchemaRef,
    '4xx': errorSchemaRef,
  },
};

export const updateOne = {
  operationId: 'updateAppData',
  tags: ['app', 'app-data'],
  summary: 'Update an app data',
  description: 'Update a given app data with new data.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    data: Type.Object({}, { additionalProperties: true }),
  }),
  response: {
    [StatusCodes.OK]: appDataWithLegacyPropsSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteAppData',
  tags: ['app', 'app-data'],
  summary: 'Delete an app data',
  description: 'Delete a given app data.',

  params: customType.StrictObject({
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

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    type: Type.Optional(
      Type.String({ description: 'Return only app data that exactly match given type.' }),
    ),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(appDataWithLegacyPropsSchemaRef, {
      descritpion: 'Successful Response',
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
