import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { accountSchemaRef } from '../../../account/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../schemas';

export const generateToken = {
  operationId: 'generateAppToken',
  tags: ['app'],
  summary: 'Generate auth token for an app',
  description: 'Generate auth token for an app to access app API',

  params: itemIdSchemaRef,
  body: Type.Object(
    {
      key: customType.UUID(),
      origin: Type.String({ format: 'url' }),
    },
    {
      additionalProperties: false,
      '4xx': errorSchemaRef,
    },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({ token: Type.String() }),
  },
} as const satisfies FastifySchema;

export const getContext = {
  operationId: 'getAppContext',
  tags: ['app'],
  summary: 'Get context information of an app',
  description: 'Get context information of an app',

  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        item: itemSchemaRef,
        members: Type.Array(accountSchemaRef),
      },
      {
        description: 'App context',
        additionalProperties: false,
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
      Type.Object(
        {
          name: Type.String(),
          description: Type.String(),
          url: Type.String(),
          extra: Type.Object({}, { additionalProperties: true }),
          // we don't want to return the id since it's the key!
        },
        {
          description: 'List of available apps',
          additionalProperties: false,
        },
      ),
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getMostUsed = {
  operationId: 'getMostUsedApp',
  tags: ['app'],
  summary: 'Get informations about most used apps',
  description: 'Get informations about most used apps',

  response: {
    [StatusCodes.OK]: Type.Array(
      Type.Object(
        {
          name: Type.String(),
          url: Type.String(),
          count: Type.Number(),
        },
        {
          description: 'Stats of most used apps',
          additionalProperties: false,
        },
      ),
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
