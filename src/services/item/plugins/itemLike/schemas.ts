import { Type } from '@sinclair/typebox';

import { registerSchemaAsRef } from '../../../../plugins/typebox';

export const itemLikeSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: Type.String({ format: 'uuid' }),
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
      id: Type.Optional(Type.String({ format: 'uuid' })),
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
      itemId: Type.String({ format: 'uuid' }),
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
    200: Type.Array(packedItemLikeSchemaRef),
  },
};

export const getLikesForItem = {
  params: itemIdSchemaRef,
  response: {
    200: Type.Array(itemLikeSchemaRef),
  },
};

export const create = {
  params: itemIdSchemaRef,
  response: {
    200: itemLikeSchemaRef,
  },
};

export const deleteOne = {
  params: itemIdSchemaRef,
  response: {
    200: Type.String({ format: 'uuid' }),
  },
};
