import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemTagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { nullableMemberSchemaRef } from '../../../member/schemas';

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

export { create, deleteOne };
