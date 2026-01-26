import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { permissionLevelSchemaRef } from '../../types';
import {
  augmentedAccountSchemaRef,
  nullableAugmentedAccountSchemaRef,
} from '../account/account.schemas';
import { itemSchemaRef } from '../item/item.schemas';

export const itemMembershipSchemaRef = registerSchemaAsRef(
  'itemMembership',
  'Item Membership',
  customType.StrictObject(
    {
      id: customType.UUID(),
      account: augmentedAccountSchemaRef,
      item: itemSchemaRef,
      permission: permissionLevelSchemaRef,
      creator: Type.Optional(nullableAugmentedAccountSchemaRef),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      description: 'Define the permission access between account and item',
    },
  ),
);

export const itemMembershipWithoutRelationsSchemaRef = registerSchemaAsRef(
  'rawItemMembership',
  'Raw Item Membership',
  customType.StrictObject(
    {
      id: customType.UUID(),
      accountId: customType.UUID(),
      itemPath: Type.String(),
      permission: permissionLevelSchemaRef,
      creator: Type.Optional(customType.UUID()),
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
  permission: permissionLevelSchemaRef,
});

// schema for creating an item membership
export const create = {
  operationId: 'createItemMembership',
  tags: ['item-membership'],
  summary: 'Create access to item for account',
  description: 'Create access to item for account, given permission',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: createItemMembershipSchema,
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getItemMembershipsForItem = {
  operationId: 'getItemMembershipsForItem',
  tags: ['item-membership'],
  summary: 'Get memberships for one item',
  description: 'Get memberships for one item',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(itemMembershipSchemaRef),
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
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({
    permission: permissionLevelSchemaRef,
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
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
    itemId: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    purgeBelow: Type.Optional(Type.Boolean()),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
