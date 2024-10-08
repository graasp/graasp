import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { UUID_REGEX, entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { augmentedAccountSchemaRef, nullableAugmentedAccountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schema';

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
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: customType.UUID(),
    },
    additionalProperties: false,
  },
  body: createItemMembershipSchemaRef,
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for creating many item memberships
export const createMany = {
  params: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: customType.UUID(),
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    properties: {
      memberships: Type.Array(createItemMembershipSchemaRef),
    },
  },
  response: {
    [StatusCodes.ACCEPTED]: {},
  },
} as const satisfies FastifySchema;

// schema for getting many item's memberships
export const getItems = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: {
        type: 'array',
        items: customType.UUID(),
      },
    },

    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: {
      type: 'object',
      // additionalProperties:true,
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: Type.Array(itemMembershipSchemaRef),
          },
        },
        errors: Type.Array(errorSchemaRef),
      },
    },
  },
} as const satisfies FastifySchema;

// schema for updating an item membership
export const updateOne = {
  params: entityIdSchemaRef,
  body: updateItemMembershipSchemaRef,
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting an item membership
export const deleteOne = {
  params: entityIdSchemaRef,
  querystring: {
    type: 'object',
    properties: {
      purgeBelow: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting all item's tree item memberships
export const deleteAll = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: customType.UUID(),
    },
    additionalProperties: false,
  },
} as const satisfies FastifySchema;
