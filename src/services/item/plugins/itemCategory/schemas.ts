import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { LIST_OF_UUID_V4_REGEX_PATTERN } from '../../../../utils/constants';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../schemas';

export const categorySchemaRef = registerSchemaAsRef(
  'category',
  'Category',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      name: Type.String(),
      type: customType.UUID(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const itemCategorySchemaRef = registerSchemaAsRef(
  'itemCategory',
  'Item Category',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      category: categorySchemaRef,
      createdAt: customType.DateTime(),
      creator: Type.Optional(nullableMemberSchemaRef),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const getItemCategories = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(itemCategorySchemaRef),
  },
};

export const getCategories = {
  querystring: Type.Partial(
    Type.Object(
      {
        typeId: Type.Array(customType.UUID()),
      },
      {
        additionalProperties: false,
      },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(categorySchemaRef),
  },
};

export const getCategory = {
  params: Type.Object(
    {
      categoryId: customType.UUID(),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: categorySchemaRef,
  },
};

export const create = {
  params: itemIdSchemaRef,
  body: Type.Object(
    {
      categoryId: customType.UUID(),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: itemCategorySchemaRef,
  },
};

export const getByCategories = {
  querystring: Type.Object(
    {
      categoryId: Type.Array(
        Type.String({
          pattern: LIST_OF_UUID_V4_REGEX_PATTERN,
        }),
      ),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
  },
};

export const deleteOne = {
  params: Type.Object(
    {
      itemId: customType.UUID(),
      itemCategoryId: customType.UUID(),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
};

export const createCategory = {
  body: Type.Object({
    name: Type.String(),
    type: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: categorySchemaRef,
  },
};

export const deleteById = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
};
