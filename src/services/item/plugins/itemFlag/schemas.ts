import { FlagType } from '@graasp/sdk';

import { itemIdSchemaRef } from '../itemLike/schemas';

export default {
  $id: 'https://graasp.org/item-flags/',
  definitions: {
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
  params: itemIdSchemaRef,
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
