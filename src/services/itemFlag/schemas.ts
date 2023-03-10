import { FlagType } from '@graasp/sdk';

export default {
  $id: 'http://graasp.org/item-flags/',
  definitions: {
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },
    // flag
    flag: { type: 'string', enum: Object.values(FlagType) },

    // item flag
    itemFlag: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        // TODO: use item schema
        item: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        type: { $ref: 'http://graasp.org/item-flags/#/definitions/flag' },
        creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },

    // item flag properties required at creation
    createPartialItemFlag: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { $ref: 'http://graasp.org/item-flags/#/definitions/flag' },
      },
      additionalProperties: false,
    },
  },
};

// schema for creating an item flag
const create = {
  params: { $ref: 'http://graasp.org/item-flags/#/definitions/itemIdParam' },
  body: { $ref: 'http://graasp.org/item-flags/#/definitions/createPartialItemFlag' },
  response: {
    201: { $ref: 'http://graasp.org/item-flags/#/definitions/itemFlag' },
  },
};

// schema for getting flags
const getFlags = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/item-flags/#/definitions/flag' },
    },
  },
};

export { create, getFlags };
