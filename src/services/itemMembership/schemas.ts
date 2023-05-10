import { PermissionLevel } from '@graasp/sdk';

import { UUID_REGEX } from '../../schemas/global';

export default {
  $id: 'http://graasp.org/item-memberships/',
  definitions: {
    // permission values
    permission: {
      type: 'string',
      enum: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
    },

    // item membership properties to be returned to the client
    itemMembership: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        member: { $ref: 'http://graasp.org/members/#/definitions/member' },
        /**
         * itemPath's 'pattern' not supported in serialization.
         * since 'itemMembership' schema is only used for serialization it's safe
         * to just use `{ type: 'string' }`
         */
        // itemPath: { $ref: 'http://graasp.org/#/definitions/itemPath' },
        // bug: cannot set item schema because it's a fluent schema
        item: { $ref: 'http://graasp.org/items/#/definitions/item' },
        // TODO: bug! should allow relative $ref: #/definitions/permission
        // check: https://github.com/fastify/fastify/issues/2328
        permission: { $ref: 'http://graasp.org/item-memberships/#/definitions/permission' },
        creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
      additionalProperties: false,
    },

    // item membership properties required at creation
    createPartialItemMembership: {
      type: 'object',
      required: ['memberId', 'permission'],
      properties: {
        memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
        permission: { $ref: '#/definitions/permission' },
      },
      additionalProperties: false,
    },

    // item membership properties that can be modified after creation
    updatePartialItemMembership: {
      type: 'object',
      required: ['permission'],
      properties: {
        permission: { $ref: '#/definitions/permission' },
      },
      additionalProperties: false,
    },
  },
};

// schema for creating an item membership
const create = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  body: { $ref: 'http://graasp.org/item-memberships/#/definitions/createPartialItemMembership' },
  response: {
    201: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' },
  },
};

// schema for creating many item memberships
const createMany = {
  params: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    properties: {
      memberships: {
        type: 'array',
        items: {
          $ref: 'http://graasp.org/item-memberships/#/definitions/createPartialItemMembership',
        },
      },
    },
  },
  response: {
    202: {},
  },
};

// schema for getting many item's memberships
const getItems = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: {
        type: 'array',
        items: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },

    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      // additionalProperties:true,
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: {
              type: 'array',
              items: {
                $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership',
              },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};

// schema for updating an item membership
const updateOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: { $ref: 'http://graasp.org/item-memberships/#/definitions/updatePartialItemMembership' },
  response: {
    200: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' },
  },
};

// schema for deleting an item membership
const deleteOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  querystring: {
    type: 'object',
    properties: {
      purgeBelow: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' },
  },
};

// schema for deleting all item's tree item memberships
const deleteAll = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};

export { getItems, create, createMany, updateOne, deleteOne, deleteAll };
