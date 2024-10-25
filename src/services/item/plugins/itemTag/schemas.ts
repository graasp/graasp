import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemTagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { itemSchemaRef } from '../../schemas';

export const itemTagSchemaRef = registerSchemaAsRef(
  'itemTag',
  'Item Tag',
  Type.Object(
    {
      id: customType.UUID(),
      type: Type.Enum(ItemTagType),
      item: itemSchemaRef,
      creator: Type.Optional(nullableMemberSchemaRef),
      createdAt: customType.DateTime(),
    },
    {
      description: 'Tag attached to an item and its descendants.',
      additionalProperties: false,
    },
  ),
);

// schema for creating an item tag
const create = {
  operationId: 'createTag',
  tags: ['tag'],
  summary: 'Create tag on item',
  description: 'Create tag on item with given tag that will apply on itself and its descendants.',

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
        description: 'Successful Response',
        additionalProperties: false,
      },
    ),
    '4xx': errorSchemaRef,
  },
};

// schema for deleting an item tag
const deleteOne = {
  operationId: 'deleteTag',
  tags: ['tag'],
  summary: 'Delete tag of item',
  description: 'Delete tag of item with given tag.',

  params: Type.Object(
    {
      itemId: customType.UUID(),
      type: Type.Enum(ItemTagType),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      { item: Type.Object({ path: Type.String() }) },
      {
        description: 'Successful Response',
      },
    ),
    '4xx': errorSchemaRef,
  },
};

export { create, deleteOne };
