export default {
  $id: 'http://graasp.org/recycle-bin/',
  definitions: {
    // item properties to be returned to the client
    recycledItem: {
      type: 'object',
      required: ['id', 'item'],
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        // TODO: use item schema
        item: {
          type: 'object',
          properties: {
            id: { $ref: 'http://graasp.org/#/definitions/uuid' },
            name: { type: 'string' },
            description: { type: ['string', 'null'] },
            type: { type: 'string' },
            path: { type: 'string' },
            extra: {
              type: 'object',
              additionalProperties: true,
            },
            creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            settings: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

// schema for getting recycled items
const getRecycledItems = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/recycle-bin/#/definitions/recycledItem' },
    },
  },
};

// schema for recycling one item
const recycleOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};
// schema for restoring one item
const restoreOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};
// schema for deleting one item
const deleteOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};

// schema for recycling >1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const recycleMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const restoreMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const deleteMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
});

export {
  getRecycledItems,
  recycleOne,
  recycleMany,
  restoreOne,
  restoreMany,
  deleteMany,
  deleteOne,
};
