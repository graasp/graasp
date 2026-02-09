import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { AppDataVisibility } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { accountSchemaRef, nullableAccountSchemaRef } from '../../../../account/account.schemas';
import { genericItemSchemaRef } from '../../../common.schemas';

const appDataSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    account: accountSchemaRef,
    item: genericItemSchemaRef,
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
    [StatusCodes.NO_CONTENT]: appDataSchemaRef,
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
    [StatusCodes.NO_CONTENT]: appDataSchemaRef,
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

export const upload = {
  operationId: 'createAppDataFile',
  tags: ['app', 'app-data', 'file'],
  summary: 'Create app data file',
  description: `Upload a file to create a corresponding app data. The created app data will have a type file and visibility ${AppDataVisibility.Member}. The data property will contain the file properties.`,

  response: {
    [StatusCodes.OK]: appDataWithLegacyPropsSchemaRef,
    '4xx': errorSchemaRef,
  },
};

export const download = {
  operationId: 'downloadAppDataFile',
  tags: ['app', 'app-data', 'file'],
  summary: 'Download app data file',
  description: 'Download app data file.',

  params: customType.StrictObject({
    id: customType.UUID({
      description: 'Id of the app data corresponding to the file to download',
    }),
  }),
  querystring: customType.StrictObject({
    replyUrl: Type.Boolean({
      default: false,
    }),
  }),

  response: {
    [StatusCodes.OK]: Type.String({ format: 'uri' }),
    '4xx': errorSchemaRef,
  },
};
