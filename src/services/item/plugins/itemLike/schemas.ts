import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';

export const itemLikeSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      item: Type.Ref('https://graasp.org/items/#/definitions/item'),
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
      item: Type.Ref('https://graasp.org/items/#/definitions/packedItem'),
    },
    {
      // Schema Options
      title: 'Packed Item Like',
      $id: 'packedItemLike',
      additionalProperties: false,
    },
  ),
);

export const itemIdSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      itemId: customType.UUID(),
    },
    {
      // Schema Options
      title: 'Item ID',
      $id: 'itemId',
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
