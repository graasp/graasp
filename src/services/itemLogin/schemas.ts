import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { accountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schema';

export const credentialsSchemaRef = registerSchemaAsRef(
  'itemLoginCredentials',
  'Item Login Credentials',
  Type.Object(
    {
      username: customType.Username(),
      password: Type.Optional(
        Type.String({ minLength: 3, maxLength: 50, pattern: '^\\S+( \\S+)*$' }),
      ),
    },
    { additionalProperties: false },
  ),
);

const itemLoginSchemaSchema = Type.Object(
  {
    id: customType.UUID(),
    type: customType.EnumString(Object.values(ItemLoginSchemaType)),
    status: customType.EnumString(Object.values(ItemLoginSchemaStatus)),
    item: Type.Optional(itemSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  { additionalProperties: false },
);
export const itemLoginSchemaSchemaRef = registerSchemaAsRef(
  'itemLoginSchema',
  'Item Login Schema',
  itemLoginSchemaSchema,
);

export const login = {
  params: entityIdSchemaRef,
  body: credentialsSchemaRef,
  response: {
    '2xx': accountSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchemaType = {
  params: entityIdSchemaRef,
  response: {
    '2xx': customType.Nullable(customType.EnumString(Object.values(ItemLoginSchemaType))),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getLoginSchema = {
  params: entityIdSchemaRef,
  response: {
    '2xx': itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateLoginSchema = {
  params: entityIdSchemaRef,
  body: Type.Partial(Type.Pick(itemLoginSchemaSchema, ['status', 'type']), { minProperties: 1 }),
  response: {
    '2xx': itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteLoginSchema = {
  params: entityIdSchemaRef,
  response: {
    '2xx': itemLoginSchemaSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
