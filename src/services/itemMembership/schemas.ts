import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { augmentedAccountSchemaRef, nullableAugmentedAccountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schemas';

export const itemMembershipSchemaRef = registerSchemaAsRef(
  'itemMembership',
  'Item Membership',
  customType.StrictObject(
    {
      id: customType.UUID(),
      account: augmentedAccountSchemaRef,
      item: itemSchemaRef,
      permission: Type.Enum(PermissionLevel),
      creator: Type.Optional(nullableAugmentedAccountSchemaRef),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      description: 'Define the permission access between account and item',
    },
  ),
);

export const createItemMembershipSchema = customType.StrictObject({
  accountId: customType.UUID(),
  permission: Type.Enum(PermissionLevel),
});

// schema for creating an item membership
export const create = {
  operationId: 'createItemMembership',
  tags: ['item-membership'],
  summary: 'Create access to item for account',
  description: 'Create access to item for account, given permission',

  querystring: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: createItemMembershipSchema,
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for creating many item memberships
export const createMany = {
  operationId: 'createManyItemMemberships',
  tags: ['item-membership'],
  summary: 'Create access to item for many accounts',
  description: 'Create access to item for many account, given permissions',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({ memberships: Type.Array(createItemMembershipSchema) }),
  response: {
    [StatusCodes.OK]: Type.Array(itemMembershipSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting many item's memberships
export const getManyItemMemberships = {
  querystring: customType.StrictObject({ itemId: Type.Array(customType.UUID()) }),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      data: Type.Record(Type.String({ format: 'uuid' }), Type.Array(itemMembershipSchemaRef)),
      errors: Type.Array(errorSchemaRef),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for updating an item membership
export const updateOne = {
  operationId: 'updateItemMembership',
  tags: ['item-membership'],
  summary: 'Update permission for item membership',
  description: 'Update permission for item membership',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    permission: Type.Enum(PermissionLevel),
  }),
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting an item membership
export const deleteOne = {
  operationId: 'deleteItemMembership',
  tags: ['item-membership'],
  summary: 'Delete access to item for account',
  description: 'Delete access to item for account',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({ purgeBelow: Type.Optional(Type.Boolean()) }),
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
