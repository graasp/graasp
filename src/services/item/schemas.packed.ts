import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemType, MAX_TARGETS_FOR_READ_REQUEST, PermissionLevel } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { nullableMemberSchemaRef } from '../member/member.schemas';
import { ITEMS_PAGE_SIZE } from './constants';
import { itemVisibilitySchemaRef } from './plugins/itemVisibility/schemas';
import { Ordering, SortBy } from './types';

export const packedItemSchemaRef = registerSchemaAsRef(
  'packedItem',
  'Packed Item',
  customType.StrictObject(
    {
      id: customType.UUID(),
      name: Type.String(),
      description: Type.Optional(customType.Nullable(Type.String())),
      type: Type.String(),
      path: Type.String(),
      lang: Type.String(),
      extra: Type.Object({}, { additionalProperties: true }),
      settings: Type.Object({}, { additionalProperties: true }),
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      permission: customType.Nullable(customType.EnumString(Object.values(PermissionLevel))),
      hidden: Type.Optional(itemVisibilitySchemaRef),
      public: Type.Optional(itemVisibilitySchemaRef),
      thumbnails: Type.Optional(Type.Object({}, { additionalProperties: true })),
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

export const getMany = {
  operationId: 'getManyItems',
  tags: ['item'],
  summary: 'Get many items',
  description: 'Get many items by their ids.',

  querystring: customType.StrictObject({
    id: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_READ_REQUEST,
      uniqueItems: true,
    }),
  }),
  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Record(Type.String({ format: 'uuid' }), packedItemSchemaRef),
      errors: Type.Array(errorSchemaRef),
    }),
    '4xx': errorSchemaRef,
  },
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
          permissions: Type.Array(Type.Enum(PermissionLevel)),
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
      totalCount: Type.Integer(),
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
      ordered: Type.Boolean({ default: true }),
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

export const getParentItems = {
  operationId: 'getParentItems',
  tags: ['item'],
  summary: 'Get parent items of item',
  description: 'Get parent items of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
