import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { accountSchemaRef } from '../../../account/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../schema';

export const appContextSchemaRef = registerSchemaAsRef(
  'appContext',
  'App Context',
  Type.Object(
    {
      // Object Definition
      item: itemSchemaRef,
      members: Type.Array(accountSchemaRef),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

// we don't want to return the id since it's the key!

export const appSchemaRef = registerSchemaAsRef(
  'app',
  'App',
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
      additionalProperties: false,
    },
  ),
);

export const mostUsedAppSchemaRef = registerSchemaAsRef(
  'mostUsedApp',
  'Most Used App',
  Type.Object(
    {
      // Object Definition
      name: Type.String(),
      url: Type.String(),
      count: Type.Number(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const generateToken = {
  params: itemIdSchemaRef,
  body: Type.Object(
    {
      key: customType.UUID(),
      origin: Type.String({ format: 'url' }),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({ token: Type.String() }),
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
