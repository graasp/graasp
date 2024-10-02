import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { UUID_V4_REGEX_PATTERN } from '../../../../utils/constants';
import { itemIdSchemaRef, itemSchemaRef } from '../../schema';

export const categorySchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      name: Type.String(),
      type: customType.UUID(),
    },
    {
      // Schema options
      title: 'Category',
      $id: 'category',
      additionalProperties: false,
    },
  ),
);

export const itemCategorySchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      category: categorySchemaRef,
      createdAt: customType.DateTime(),
      creator: Type.Optional(Type.Ref('https://graasp.org/members/#/definitions/member')),
    },
    {
      // Schema options
      title: 'Item Category',
      $id: 'itemCategory',
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
  querystring: {
    type: 'object',
    properties: {
      typeId: {
        type: 'array',
        items: customType.UUID(),
      },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: Type.Array(categorySchemaRef),
  },
};

export const getCategory = {
  params: {
    type: 'object',
    properties: {
      categoryId: customType.UUID(),
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: categorySchemaRef,
  },
};

export const create = {
  params: itemIdSchemaRef,
  body: {
    type: 'object',
    properties: {
      categoryId: customType.UUID(),
    },
  },
  response: {
    [StatusCodes.OK]: itemCategorySchemaRef,
  },
};

export const getByCategories = {
  querystring: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: Type.Array(
        Type.String({
          pattern: `^${UUID_V4_REGEX_PATTERN}(,${UUID_V4_REGEX_PATTERN})*$`,
        }),
      ),
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
  },
};

export const deleteOne = {
  params: {
    type: 'object',
    required: ['itemId', 'itemCategoryId'],
    properties: {
      itemId: customType.UUID(),
      itemCategoryId: customType.UUID(),
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: customType.UUID(),
  },
};

export const createCategory = {
  body: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: customType.UUID(),
    },
  },
  response: {
    [StatusCodes.OK]: categorySchemaRef,
  },
};

export const deleteById = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: customType.UUID(),
    },
    additionalProperties: false,
  },
};
