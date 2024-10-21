import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { accountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schema';

const itemLoginSchemaSchema = Type.Object(
  {
    id: customType.UUID(),
    type: customType.EnumString(Object.values(ItemLoginSchemaType)),
    status: customType.EnumString(Object.values(ItemLoginSchemaStatus)),
    item: Type.Optional(itemSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    description: 'Item login Schema for an item, including its status and type',
    additionalProperties: false,
  },
);
export const itemLoginSchemaSchemaRef = registerSchemaAsRef(
  'itemLoginSchema',
  'Item Login Schema',
  itemLoginSchemaSchema,
);

export const login = {
  operationId: 'loginItemLogin',
  tags: ['authentication', 'itemLogin'],
  summary: 'Register or login to guest account',
  description:
    'Register or login to guest account. Required inputs depends on the item login schema type. ',

  params: entityIdSchemaRef,
  body: Type.Object(
    {
      username: customType.Username(),
      password: Type.Optional(
        Type.String({ minLength: 3, maxLength: 50, pattern: '^\\S+( \\S+)*$' }),
      ),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: accountSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchemaType = {
  operationId: 'getItemLoginSchemaType',
  tags: ['itemLogin'],
  summary: 'Get item login schema type',
  description: 'Get item logins schema type. Publicly available.',

  params: entityIdSchemaRef,
  response: {
    '2xx': customType.Nullable(customType.EnumString(Object.values(ItemLoginSchemaType))),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchema = {
  operationId: 'getItemLoginSchema',
  tags: ['itemLogin'],
  summary: 'Get item login schema',
  description: 'Get item logins schema.',

  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateLoginSchema = {
  operationId: 'updateItemLoginSchema',
  tags: ['itemLogin'],
  summary: 'Update item login schema',
  description: 'Update item logins schema type and/or status.',

  params: entityIdSchemaRef,
  body: Type.Partial(Type.Pick(itemLoginSchemaSchema, ['status', 'type']), { minProperties: 1 }),
  response: {
    [StatusCodes.OK]: itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
