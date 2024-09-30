import { Type } from '@sinclair/typebox';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { UUID_REGEX, errorSchemaRef } from '../../../../schemas/global';
import { itemTag, itemTagType } from '../../fluent-schema';
import { itemIdSchemaRef } from '../itemLike/schemas';

export default {
  $id: 'https://graasp.org/item-tags/',
  definitions: {
    idParam: {
      type: 'object',
      required: ['id'],
      properties: {
        id: customType.UUID(),
      },
    },

    // item tag properties to be returned to the client
    itemTagType,

    // item tag properties to be returned to the client
    itemTag,

    // item tag properties required at creation
    createPartialItemTag: {
      type: 'object',
      required: ['tagId'],
      properties: {
        tagId: customType.UUID(),
      },
      additionalProperties: false,
    },

    // tag
    tag: {
      type: 'object',
      properties: {
        id: customType.UUID(),
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
      itemId: customType.UUID(),
      type: { $ref: 'https://graasp.org/item-tags/#/definitions/itemTagType' },
    },
  },
  response: {
    201: { $ref: 'https://graasp.org/item-tags/#/definitions/itemTag' },
  },
};

// schema for getting an item's tags
const getItemTags = {
  params: itemIdSchemaRef,
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/item-tags/#/definitions/itemTag' },
    },
  },
};

const getMany = {
  querystring: Type.Object({
    id: Type.Array(customType.UUID(), {
      uniqueItems: true,
      minItems: 1,
      maxItems: MAX_TARGETS_FOR_READ_REQUEST,
    }),
  }),
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
                $ref: 'https://graasp.org/item-tags/#/definitions/itemTag',
              },
            },
          },
        },
        errors: Type.Array(errorSchemaRef),
      },
    },
  },
};

// schema for deleting an item tag
const deleteOne = {
  params: {
    type: 'object',
    properties: {
      itemId: customType.UUID(),
      type: { $ref: 'https://graasp.org/item-tags/#/definitions/itemTagType' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/item-tags/#/definitions/itemTag' },
  },
};

// schema for getting available tags
const getTags = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/item-tags/#/definitions/tag' },
    },
  },
};

export { getItemTags, create, deleteOne, getTags, getMany };
