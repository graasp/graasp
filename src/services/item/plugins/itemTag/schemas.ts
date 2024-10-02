import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemTagType, MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { UUID_REGEX, errorSchemaRef } from '../../../../schemas/global';
import { itemIdSchemaRef, itemTagSchemaRef } from '../../schema';

export const tagSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      name: Type.String(),
      nested: Type.String(),
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      title: 'Tag',
      $id: 'tag',
      additionalProperties: false,
    },
  ),
);

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
    [StatusCodes.OK]: Type.Array(tagSchemaRef),
  },
};

export { getItemTags, create, deleteOne, getTags, getMany };
