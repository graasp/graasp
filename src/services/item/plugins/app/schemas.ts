import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { accountSchemaRef } from '../../../account/schemas';
import { itemSchema, itemSchemaRef } from '../../schemas';
import { geoCoordinateSchemaRef } from '../geolocation/schemas';

export const generateToken = {
  operationId: 'generateAppToken',
  tags: ['app'],
  summary: 'Generate auth token for an app',
  description: 'Generate auth token for an app to access app API',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({
    key: customType.UUID(),
    origin: Type.String({ format: 'url' }),
  }),
  response: {
    [StatusCodes.OK]: Type.Object({ token: Type.String() }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getContext = {
  operationId: 'getAppContext',
  tags: ['app'],
  summary: 'Get context information of an app',
  description: 'Get context information of an app',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject(
      {
        item: itemSchemaRef,
        members: Type.Array(accountSchemaRef),
      },
      {
        description: 'App context',
      },
    ),
  },
} as const satisfies FastifySchema;

export const getList = {
  operationId: 'getAppList',
  tags: ['app'],
  summary: 'Get list of available apps',
  description: 'Get list of available apps',

  response: {
    [StatusCodes.OK]: Type.Array(
      customType.StrictObject(
        {
          name: Type.String(),
          description: Type.String(),
          url: Type.String(),
          extra: Type.Object({}, { additionalProperties: true }),
          // we don't want to return the id since it's the key!
        },
        {
          description: 'List of available apps',
        },
      ),
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnMostUsedApps = {
  operationId: 'getOwnMostUsedApps',
  tags: ['app'],
  summary: "Get the user's most used apps",
  description:
    'Get a list of the apps the user has used the most to ease the addition of new apps.',

  response: {
    [StatusCodes.OK]: Type.Array(
      customType.StrictObject({
        name: Type.String(),
        url: Type.String(),
        count: Type.Number(),
      }),
      {
        description: 'Apps regularly used by the user',
      },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const appItemSchema = Type.Composite(
  [
    itemSchema,
    customType.StrictObject({
      extra: customType.StrictObject({
        app: customType.StrictObject({
          url: Type.String({ format: 'uri' }),
        }),
      }),
    }),
  ],
  {
    title: 'App Item',
    description:
      'Item of type app, represents an interactive application that can access to the app API.',
  },
);

export const createApp = {
  operationId: 'createApp',
  tags: ['item', 'app'],
  summary: 'Create app',
  description: 'Create app.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    Type.Pick(itemSchema, ['name']),
    Type.Partial(Type.Pick(itemSchema, ['description', 'lang', 'settings'])),
    customType.StrictObject({ url: Type.String({ format: 'uri' }) }),

    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ]),
  response: { [StatusCodes.OK]: appItemSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateApp = {
  operationId: 'updateApp',
  tags: ['item', 'app'],
  summary: 'Update app',
  description: 'Update app given body.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(
    Type.Composite([Type.Pick(appItemSchema, ['name', 'description', 'lang', 'settings'])]),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.OK]: appItemSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
