export default {
  $id: 'http://graasp.org/item-memberships/',
  definitions: {
    // permission values
    permission: {
      type: 'string',
      enum: ['read', 'write', 'admin']
    },

    // item membership properties to be returned to the client
    itemMembership: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
        /**
         * itemPath's 'pattern' not supported in serialization.
         * since 'itemMembership' schema is only used for serialization it's safe
         * to just use `{ type: 'string' }`
         */
        // itemPath: { $ref: 'http://graasp.org/#/definitions/itemPath' },
        itemPath: { type: 'string' },
        // TODO: bug! should allow relative $ref: #/definitions/permission
        // check: https://github.com/fastify/fastify/issues/2328
        permission: { $ref: 'http://graasp.org/item-memberships/#/definitions/permission' },
        creator: { $ref: 'http://graasp.org/#/definitions/uuid' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      },
      additionalProperties: false
    },

    // item membership properties required at creation
    createPartialItemMembership: {
      type: 'object',
      required: ['memberId'],
      properties: {
        memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
        permission: { $ref: '#/definitions/permission' },
      },
      additionalProperties: false
    },

    // item membership properties that can be modified after creation
    updatePartialItemMembership: {
      type: 'object',
      required: ['permission'],
      properties: {
        permission: { $ref: '#/definitions/permission' },
      },
      additionalProperties: false
    }
  }
};

// schema for creating an item membership
const create = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  },
  body: { $ref: 'http://graasp.org/item-memberships/#/definitions/createPartialItemMembership' },
  response: {
    201: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' }
  }
};

// schema for getting an item's memberships
const getItems = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' }
    }
  }
};

// schema for updating an item membership
const updateOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: { $ref: 'http://graasp.org/item-memberships/#/definitions/updatePartialItemMembership' },
  response: {
    200: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' }
  }
};

// schema for deleting an item membership
const deleteOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/item-memberships/#/definitions/itemMembership' }
  }
};

export {
  getItems,
  create,
  updateOne,
  deleteOne
};
