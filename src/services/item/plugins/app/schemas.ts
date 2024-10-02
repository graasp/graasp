import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef } from '../../schema';

export const appContextSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      item: itemSchemaRef,
      members: Type.Array(Type.Ref('https://graasp.org/members/#/definitions/member')),
    },
    {
      // Schema Options
      title: 'App Context',
      $id: 'appContext',
      additionalProperties: false,
    },
  ),
);

// we don't want to return the id since it's the key!

export const appSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      name: Type.String(),
      description: Type.String(),
      url: Type.String(),
      extra: Type.Object({}, { additionalProperties: true }),
    },
    {
      // Schema Options
      title: 'App',
      $id: 'app',
      additionalProperties: false,
    },
  ),
);

export const mostUsedAppSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      name: Type.String(),
      url: Type.String(),
      count: Type.Number(),
    },
    {
      // Schema Options
      title: 'Most Used App',
      $id: 'mostUsedApp',
      additionalProperties: false,
    },
  ),
);

export const generateToken = {
  params: itemIdSchemaRef,
  body: {
    type: 'object',
    required: ['key', 'origin'],
    properties: {
      key: customType.UUID(),
      origin: { type: 'string', format: 'url' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: { token: { type: 'string' } },
    },
  },
} as const satisfies FastifySchema;

export const getContext = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: appContextSchemaRef,
  },
} as const satisfies FastifySchema;

export const getMany = {
  response: {
    [StatusCodes.OK]: Type.Array(appSchemaRef),
  },
} as const satisfies FastifySchema;

export const getMostUsed = {
  response: {
    [StatusCodes.OK]: Type.Array(mostUsedAppSchemaRef),
  },
} as const satisfies FastifySchema;
