import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemTagType, MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { UUID_REGEX, errorSchemaRef } from '../../../../schemas/global';
import { itemIdSchemaRef, itemTagSchemaRef } from '../../schema';

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
      type: Type.Enum(ItemTagType),
    },
  },
  response: {
    [StatusCodes.CREATED]: itemTagSchemaRef,
  },
};

// schema for getting an item's tags
const getItemTags = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(itemTagSchemaRef),
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
    [StatusCodes.OK]: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: Type.Array(itemTagSchemaRef),
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
      type: Type.Enum(ItemTagType),
    },
  },
  response: {
    [StatusCodes.OK]: Type.Object({ item: Type.Object({ path: Type.String() }) }),
  },
};

// schema for getting available tags
const getTags = {
  response: {
    [StatusCodes.OK]: {
      type: 'array',
      items: { $ref: 'https://graasp.org/item-tags/#/definitions/tag' },
    },
  },
};

export { getItemTags, create, deleteOne, getTags, getMany };
