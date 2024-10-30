import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { accountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schemas';

const itemLoginSchemaSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    type: customType.EnumString(Object.values(ItemLoginSchemaType), {
      description: 'Defined which credentials are necessary to login.',
    }),
    status: customType.EnumString(Object.values(ItemLoginSchemaStatus), {
      description:
        'Whether the item login is enabled, freezed or disabled. An item login is never deleted, but disabled instead to prevent attached guests to be deleted.',
    }),
    item: Type.Optional(itemSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    description:
      'Instance allowing to login without a member on related item and its descendants. The required credentials are defined given the status.',
  },
);

export const itemLoginSchemaSchemaRef = registerSchemaAsRef(
  'itemLoginSchema',
  'Item Login Schema',
  itemLoginSchemaSchema,
);

export const loginOrRegister = {
  operationId: 'itemLogin',
  tags: ['item-login'],
  summary: 'Login or Register in item',
  description: `Login in item with necessary credentials depending on item login's status. If the username does not exist, a guest account is created and the user is logged in.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    username: customType.Username(),
    password: Type.Optional(
      Type.String({ minLength: 3, maxLength: 50, pattern: '^\\S+( \\S+)*$' }),
    ),
  }),
  response: {
    [StatusCodes.OK]: accountSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchemaType = {
  operationId: 'getItemLoginSchemaType',
  tags: ['item-login'],
  summary: 'Get type of item login',
  description: `Get type of item login. Return null if the item does not allow item login.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(
      customType.EnumString(Object.values(ItemLoginSchemaType)),
    ),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchema = {
  operationId: 'getItemLoginSchema',
  tags: ['item-login'],
  summary: 'Get item login data',
  description: `Get item login data.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateLoginSchema = {
  operationId: 'updateItemLoginSchema',
  tags: ['item-login'],
  summary: 'Update item login data',
  description: `Update item login's status and/or type.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(Type.Pick(itemLoginSchemaSchema, ['status', 'type']), { minProperties: 1 }),
  response: {
    [StatusCodes.OK]: itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
