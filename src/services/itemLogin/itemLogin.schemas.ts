import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { accountSchemaRef } from '../account/account.schemas';
import { genericItemSchemaRef } from '../item/common.schemas';

const itemLoginSchemaSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    type: customType.EnumString(Object.values(ItemLoginSchemaType), {
      description: 'Defines which credentials are necessary to login.',
    }),
    status: customType.EnumString(Object.values(ItemLoginSchemaStatus), {
      description:
        'Item login status, which can be enabled, frozen, or disabled. Item login cannot be deleted, an item login can be disabled instead to prevent deleting associated guest accounts.',
    }),
    item: Type.Optional(genericItemSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    description:
      'Instance allowing to login without a member on related item and its descendants. The required credentials are defined given the type.',
  },
);

export const itemLoginSchemaSchemaRef = registerSchemaAsRef(
  'itemLoginSchema',
  'Item Login Schema',
  itemLoginSchemaSchema,
);

export const loginOrRegisterAsGuest = {
  operationId: 'loginOrRegisterAsGuest',
  tags: ['item-login'],
  summary: 'Login or Register in item as guest',
  description: `Log in to an item with necessary credentials depending on item login's type. If the username does not exist, a guest account is created and is given access.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    username: customType.Username(),
    password: Type.Optional(Type.String({ minLength: 3, maxLength: 50 })),
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

export const getItemLoginSchema = {
  operationId: 'getItemLoginSchema',
  tags: ['item-login'],
  summary: 'Get item login data',
  description: `Get item login data.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: itemLoginSchemaSchemaRef,
    [StatusCodes.NO_CONTENT]: Type.Null({
      description: 'Response if item does not have an item login',
    }),
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
    [StatusCodes.OK]: Type.Null({ descriptipn: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteLoginSchema = {
  operationId: 'deleteItemLoginSchema',
  tags: ['item-login'],
  summary: 'Delete item login schema',
  description: `Delete item login data and all related users.`,

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Null({ descriptipn: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
