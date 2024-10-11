import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemTagType, MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { UUID_REGEX, errorSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { itemIdSchemaRef, itemTagSchemaRef } from '../../schema';

export const tagSchemaRef = registerSchemaAsRef(
  'tag',
  'Tag',
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
      additionalProperties: false,
    },
  ),
);

// schema for creating an item tag
const create = {
  params: Type.Object(
    {
      itemId: customType.UUID(),
      type: Type.Enum(ItemTagType),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.CREATED]: Type.Object(
      {
        id: customType.UUID(),
        type: Type.Enum(ItemTagType),
        item: Type.Object({ path: Type.String() }),
        creator: Type.Optional(nullableMemberSchemaRef),
        createdAt: customType.DateTime(),
      },
      {
        additionalProperties: false,
      },
    ),
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
    [StatusCodes.OK]: Type.Object(
      {
        data: Type.Record(Type.String({ pattern: UUID_REGEX }), Type.Array(itemTagSchemaRef)),
        errors: Type.Array(errorSchemaRef),
      },
      { additionalProperties: false },
    ),
  },
};

// schema for deleting an item tag
const deleteOne = {
  params: Type.Object(
    {
      itemId: customType.UUID(),
      type: Type.Enum(ItemTagType),
    },
    { additionalProperties: false },
  ),
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
