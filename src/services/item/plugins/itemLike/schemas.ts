import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef } from '../../schemas';
import { packedItemSchemaRef } from '../../schemas.packed';

export const itemLikeSchemaRef = registerSchemaAsRef(
  'itemLike',
  'Item Like',
  customType.StrictObject(
    {
      id: customType.UUID(),
      item: itemSchemaRef,
    },
    {
      description: 'Like object of an item when a member likes it.',
    },
  ),
);

export const packedItemLikeSchemaRef = registerSchemaAsRef(
  'packedItemLike',
  'Packed Item Like',
  customType.StrictObject(
    {
      id: Type.Optional(customType.UUID()),
      item: packedItemSchemaRef,
    },
    {
      description: 'Like object of an item when a member likes it. Item property is a packed item',
    },
  ),
);
export const getLikesForCurrentMember = {
  operationId: 'getLikesForCurrentMember',
  tags: ['like', 'current'],
  summary: 'Get likes for current member',
  description: 'Get likes for current member. Item property is a packed item.',

  response: {
    [StatusCodes.OK]: Type.Array(packedItemLikeSchemaRef, { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};

export const getLikesForItem = {
  operationId: 'getLikesForItem',
  tags: ['like'],
  summary: 'Get likes for item',
  description: 'Get likes for item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(itemLikeSchemaRef, { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};

export const create = {
  operationId: 'createItemLike',
  tags: ['like'],
  summary: 'Like item',
  description: 'Like item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: itemLikeSchemaRef,
    '4xx': errorSchemaRef,
  },
};

export const deleteOne = {
  operationId: 'deleteItemLike',
  tags: ['like'],
  summary: 'Unlike item',
  description: 'Unlike item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.UUID({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};
