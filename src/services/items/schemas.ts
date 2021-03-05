import {
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST
} from '../../util/config';

export default {
  $id: 'http://graasp.org/items/',
  definitions: {
    // item properties to be returned to the client
    item: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        type: { type: 'string' },
        /**
         * itemPath's 'pattern' not supported in serialization.
         * since 'item' schema is only used for serialization it's safe
         * to just use `{ type: 'string' }`
         */
        // path: { $ref: 'http://graasp.org/#/definitions/itemPath' },
        path: { type: 'string' },
        extra: {
          type: 'object',
          additionalProperties: true
        },
        creator: { $ref: 'http://graasp.org/#/definitions/uuid' },
        /**
         * for some reason setting these date fields as "type: 'string'"
         * makes the serialization fail using the anyOf. Following the same
         * logic from above, here it's also safe to just remove that specification.
         */
        // createdAt: { type: 'string' },
        // updatedAt: { type: 'string' }
        createdAt: {},
        updatedAt: {}
      },
      additionalProperties: false
    },

    // item properties that can be modified with user input
    partialItem: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, pattern: '^\\S+( \\S+)*$' },
        type: { type: 'string', minLength: 3, pattern: '^\\S+( \\S+)*$' },
        description: { type: 'string' },
        extra: { type: 'object', additionalProperties: true }
      },
      additionalProperties: false
    },

    // partialItem requiring one property to be defined
    partialItemRequireOne: {
      allOf: [
        { $ref: '#/definitions/partialItem' },
        {
          anyOf: [
            { required: ['name'] },
            { required: ['description'] },
            { required: ['extra'] }
          ]
        }
      ]
    }
  }
};

// schema for creating an item
const create = {
  querystring: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  },
  body: {
    allOf: [
      { $ref: 'http://graasp.org/items/#/definitions/partialItem' },
      { required: ['name'] }
    ]
  },
  response: {
    201: { $ref: 'http://graasp.org/items/#/definitions/item' }
  }
};

// schema for getting one item
const getOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/items/#/definitions/item' }
  }
};

// schema for getting one item's children
const getChildren = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/items/#/definitions/item' }
    }
  }
};

// schema for getting >1 items
const getMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_READ_REQUEST } } }
    ]
  },
  response: {
    200: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: 'http://graasp.org/#/definitions/error' },
          { $ref: 'http://graasp.org/items/#/definitions/item' },
        ]
      }
    }
  }
};

// schema for getting member's own items and items shared with him/her
const getOwnAndShared = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/items/#/definitions/item' }
    }
  }
};

// schema for updating an item
const updateOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: { $ref: 'http://graasp.org/items/#/definitions/partialItemRequireOne' },
  response: {
    200: { $ref: 'http://graasp.org/items/#/definitions/item' }
  }
};

// schema for updating up to 10 items
const updateMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST } } }
    ]
  },
  body: { $ref: 'http://graasp.org/items/#/definitions/partialItemRequireOne' },
  response: {
    200: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: 'http://graasp.org/#/definitions/error' },
          { $ref: 'http://graasp.org/items/#/definitions/item' }
        ]
      }
    },
    202: { // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'http://graasp.org/#/definitions/uuid' }
    }
  }
};

// schema for deleting one item
const deleteOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/items/#/definitions/item' }
  }
};

// schema for deleting >1 items
const deleteMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST } } }
    ]
  },
  response: {
    200: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: 'http://graasp.org/#/definitions/error' },
          { $ref: 'http://graasp.org/items/#/definitions/item' }
        ]
      }
    },
    202: { // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'http://graasp.org/#/definitions/uuid' }
    }
  }
};

// schema for moving one item
const moveOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  }
};

// schema for moving >1 items
const moveMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST } } }
    ]
  },
  body: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  }
};

// schema for copying one item
const copyOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  }
};

// schema for copying >1 items
const copyMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST } } }
    ]
  },
  body: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  }
};

export {
  create,
  getOne,
  getChildren,
  getMany,
  getOwnAndShared,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  moveOne,
  moveMany,
  copyOne,
  copyMany
};
