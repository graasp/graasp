import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef, packedItemSchemaRef } from '../../schema';

export const itemLikeSchemaRef = registerSchemaAsRef(
  'itemLike',
  'Item Like',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      item: itemSchemaRef,
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const packedItemLikeSchemaRef = registerSchemaAsRef(
  'packedItemLike',
  'Packed Item Like',
  Type.Object(
    {
      // Object Definition
      id: Type.Optional(customType.UUID()),
      item: packedItemSchemaRef,
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);
export const getLikesForMember = {
  response: {
    [StatusCodes.OK]: Type.Array(packedItemLikeSchemaRef),
  },
};

export const getLikesForItem = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(itemLikeSchemaRef),
  },
};

export const create = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: itemLikeSchemaRef,
  },
};

export const deleteOne = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
};
