import { FlagType } from '@graasp/sdk';

export default {
  $id: 'https://graasp.org/item-flags/',
  definitions: {
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },
    // flag
    flag: { type: 'string', enum: Object.values(FlagType) },

    // item flag
    itemFlag: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        type: { $ref: 'https://graasp.org/item-flags/#/definitions/flag' },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },

    // item flag properties required at creation
    createPartialItemFlag: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { $ref: 'https://graasp.org/item-flags/#/definitions/flag' },
      },
      additionalProperties: false,
    },
  },
};

// schema for creating an item flag
const create = {
  params: { $ref: 'https://graasp.org/item-flags/#/definitions/itemIdParam' },
  body: { $ref: 'https://graasp.org/item-flags/#/definitions/createPartialItemFlag' },
  response: {
    201: { $ref: 'https://graasp.org/item-flags/#/definitions/itemFlag' },
  },
};

// schema for getting flag types
const getFlagTypes = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/item-flags/#/definitions/flag' },
    },
  },
};

export { create, getFlagTypes };
