import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef, packedItemSchemaRef } from '../../schema';

export const itemLikeSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      item: itemSchemaRef,
    },
    {
      // Schema Options
      title: 'Item Like',
      $id: 'itemLike',
      additionalProperties: false,
    },
  ),
);

export const packedItemLikeSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: Type.Optional(customType.UUID()),
      item: packedItemSchemaRef,
    },
    {
      // Schema Options
      title: 'Packed Item Like',
      $id: 'packedItemLike',
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
