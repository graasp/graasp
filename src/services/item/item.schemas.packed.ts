import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { permissionLevelSchemaRef } from '../../types';
import { nullableMemberSchemaRef } from '../member/member.schemas';
import { ITEMS_PAGE_SIZE } from './constants';
import { itemVisibilitySchemaRef } from './plugins/itemVisibility/itemVisibility.schemas';
import { Ordering, SortBy } from './types';

export const packedItemSchemaRef = registerSchemaAsRef(
  'packedItem',
  'Packed Item',
  customType.StrictObject(
    {
      id: customType.UUID(),
      name: Type.String(),
      description: Type.Optional(customType.Nullable(Type.String())),
      type: customType.EnumString(Object.values(ItemType)),
      path: Type.String(),
      lang: Type.String(),
      extra: Type.Object({}, { additionalProperties: true }),
      settings: Type.Object({}, { additionalProperties: true }),
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      permission: Type.Union([permissionLevelSchemaRef, Type.Null()]),
      hidden: Type.Optional(itemVisibilitySchemaRef),
      public: Type.Optional(itemVisibilitySchemaRef),
      thumbnails: Type.Optional(
        customType.StrictObject(
          {
            small: Type.String({ format: 'uri' }),
            medium: Type.String({ format: 'uri' }),
          },
          { additionalProperties: true },
        ),
      ),
    },
    {
      description: 'Item with additional information',
    },
  ),
);

export const getOne = {
  operationId: 'getItem',
  tags: ['item'],
  summary: 'Get item',
  description: 'Get item by its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: packedItemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const getAccessible = {
  operationId: 'getAccessibleItems',
  tags: ['item'],
  summary: 'Get accessible items',
  description: 'Get items the user has access to',

  querystring: Type.Composite(
    [
      customType.Pagination({ page: { default: 1 }, pageSize: { default: ITEMS_PAGE_SIZE } }),
      Type.Partial(
        customType.StrictObject({
          creatorId: Type.String(),
          permissions: Type.Array(permissionLevelSchemaRef),
          types: Type.Array(Type.Enum(ItemType)),
          keywords: Type.Array(Type.String()),
          sortBy: Type.Enum(SortBy),
          ordering: Type.Enum(Ordering),
        }),
      ),
    ],
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Array(packedItemSchemaRef),
      pagination: customType.Pagination({
        page: {
          minimum: 0,
          default: 1,
        },
        pageSize: { minimum: 1, default: ITEMS_PAGE_SIZE },
      }),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getChildren = {
  operationId: 'getChildren',
  tags: ['item'],
  summary: 'Get children of item',
  description: 'Get children of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    customType.StrictObject({
      keywords: Type.Array(Type.String()),
      types: Type.Array(Type.Enum(ItemType)),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getDescendantItems = {
  operationId: 'getDescendantItems',
  tags: ['item'],
  summary: 'Get descendant items of item',
  description: 'Get descendant items of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    customType.StrictObject({
      // showHidden default value is true so it handles the legacy behavior.
      showHidden: Type.Boolean({ default: true }),
      types: Type.Array(Type.Enum(ItemType)),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
