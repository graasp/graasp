export default {
  $id: 'https://graasp.org/recycle-bin/',
  definitions: {
    // item properties to be returned to the client
    recycledItem: {
      type: 'object',
      required: ['id', 'item'],
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

// schema for getting recycled items
const getRecycledItemDatas = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/recycle-bin/#/definitions/recycledItem' },
    },
  },
};

// schema for recycling one item
const recycleOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'https://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};
// schema for restoring one item
const restoreOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'https://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};
// schema for deleting one item
const deleteOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'https://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};

// schema for recycling >1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const recycleMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'https://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const restoreMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'https://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const deleteMany = (maxItems: number) => ({
  querystring: {
    allOf: [
      { $ref: 'https://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems } } },
    ],
  },
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
});

export {
  getRecycledItemDatas,
  recycleOne,
  recycleMany,
  restoreOne,
  restoreMany,
  deleteMany,
  deleteOne,
};
