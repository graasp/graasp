import {
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST
} from 'util/config';

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
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      },
      additionalProperties: false
    },

    // item properties that can be modified with user input
    partialItem: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        type: { type: 'string', minLength: 1 },
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
          { $ref: 'http://graasp.org/items/#/definitions/item' },
          { $ref: 'http://graasp.org/#/definitions/error' }
        ]
      }
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
          { $ref: 'http://graasp.org/items/#/definitions/item' },
          { $ref: 'http://graasp.org/#/definitions/error' }
        ]
      }
    },
    202: { // ids > MAX_TARGETS_FOR_CHANGING_REQUEST_W_RESPONSE
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
          { $ref: 'http://graasp.org/items/#/definitions/item' },
          { $ref: 'http://graasp.org/#/definitions/error' }
        ]
      }
    },
    202: { // ids > MAX_TARGETS_FOR_CHANGING_REQUEST_W_RESPONSE
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
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  moveOne,
  moveMany,
  copyOne,
  copyMany
};
