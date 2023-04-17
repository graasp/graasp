import { ItemTagType } from '@graasp/sdk';

// TODO export
const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const MAX_ITEMS_FOR_GET = 30;

export default {
  $id: 'http://graasp.org/item-tags/',
  definitions: {
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },

    idParam: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },

    // item tag properties to be returned to the client
    itemTagType: {
      type: 'string',
      enum: Object.values(ItemTagType),
    },

    // item tag properties to be returned to the client
    itemTag: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        type: { $ref: 'http://graasp.org/item-tags/#/definitions/itemTagType' },
        item: {
          $ref: 'http://graasp.org/items/#/definitions/item',
        },
        creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },

    // item tag properties required at creation
    createPartialItemTag: {
      type: 'object',
      required: ['tagId'],
      properties: {
        tagId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
      additionalProperties: false,
    },

    // tag
    tag: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        name: { type: 'string' },
        nested: { type: 'string' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

// schema for creating an item tag
const create = {
  params: {
    type: 'object',
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      type: { $ref: 'http://graasp.org/item-tags/#/definitions/itemTagType' },
    },
  },
  response: {
    201: { $ref: 'http://graasp.org/item-tags/#/definitions/itemTag' },
  },
};

// schema for getting an item's tags
const getItemTags = {
  params: { $ref: 'http://graasp.org/item-tags/#/definitions/itemIdParam' },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/item-tags/#/definitions/itemTag' },
    },
  },
};

const getMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { type: 'object', properties: { id: { type: 'array', maxItems: MAX_ITEMS_FOR_GET } } },
    ],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: {
              type: 'array',
              items: {
                $ref: 'http://graasp.org/item-tags/#/definitions/itemTag',
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

// schema for deleting an item tag
const deleteOne = {
  params: {
    type: 'object',
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      type: { $ref: 'http://graasp.org/item-tags/#/definitions/itemTagType' },
    },
  },
  response: {
    200: {},
  },
};

// schema for getting available tags
const getTags = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/item-tags/#/definitions/tag' },
    },
  },
};

export { getItemTags, create, deleteOne, getTags, getMany };
