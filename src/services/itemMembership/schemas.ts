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
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      account: augmentedAccountSchemaRef,
      item: itemSchemaRef,
      permission: Type.Enum(PermissionLevel),
      creator: Type.Optional(nullableAugmentedAccountSchemaRef),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const createItemMembershipSchemaRef = registerSchemaAsRef(
  'createItemMembership',
  'Create Item Membership',
  Type.Object(
    {
      accountId: customType.UUID(),
      permission: Type.Enum(PermissionLevel),
    },
    {
      additionalProperties: false,
    },
  ),
);

export const updateItemMembershipSchemaRef = registerSchemaAsRef(
  'updateItemMembership',
  'Update Item Membership',
  Type.Object(
    {
      permission: Type.Enum(PermissionLevel),
    },
    {
      additionalProperties: false,
    },
  ),
);

// schema for creating an item membership
export const create = {
  querystring: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: createItemMembershipSchemaRef,
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for creating many item memberships
export const createMany = {
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: Type.Object(
    { memberships: Type.Array(createItemMembershipSchemaRef) },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.ACCEPTED]: {},
  },
} as const satisfies FastifySchema;

// schema for getting many item's memberships
export const getItems = {
  querystring: Type.Object(
    { itemId: Type.Array(customType.UUID()) },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Record(Type.String({ format: 'uuid' }), Type.Array(itemMembershipSchemaRef)),
      errors: Type.Array(errorSchemaRef),
    }),
  },
} as const satisfies FastifySchema;

// schema for updating an item membership
export const updateOne = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: updateItemMembershipSchemaRef,
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting an item membership
export const deleteOne = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Object(
    { purgeBelow: Type.Optional(Type.Boolean()) },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting all item's tree item memberships
export const deleteAll = {
  querystring: Type.Object({ itemId: customType.UUID() }, { additionalProperties: false }),
} as const satisfies FastifySchema;
