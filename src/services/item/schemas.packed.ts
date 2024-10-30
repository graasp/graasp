import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { nullableMemberSchemaRef } from '../member/schemas';
import { ITEMS_PAGE_SIZE } from './constants';
import { itemTagSchemaRef } from './plugins/itemTag/schemas';
import { SHOW_HIDDEN_PARRAM, TYPES_FILTER_PARAM } from './schemas';
import { Ordering, SortBy } from './types';

export const packedItemSchemaRef = registerSchemaAsRef(
  'packedItem',
  'Packed Item',
  Type.Object(
    {
      // Object Definition
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
      hidden: Type.Optional(itemTagSchemaRef),
      public: Type.Optional(itemTagSchemaRef),
      thumbnails: Type.Optional(Type.Object({}, { additionalProperties: true })),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const getOne = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: packedItemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const getAccessible = {
  querystring: Type.Composite(
    [
      customType.Pagination({ page: { default: 1 }, pageSize: { default: ITEMS_PAGE_SIZE } }),
      Type.Partial(
        Type.Object(
          {
            creatorId: Type.String(),
            permissions: Type.Array(Type.Enum(PermissionLevel)),
            types: Type.Array(Type.Enum(ItemType)),
            keywords: Type.Array(Type.String()),
            sortBy: Type.Enum(SortBy),
            ordering: Type.Enum(Ordering),
          },
          { additionalProperties: false },
        ),
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
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    Type.Object(
      {
        ordered: Type.Boolean({ default: true }),
        keywords: Type.Array(Type.String()),
        types: Type.Array(Type.Enum(ItemType)),
      },
      { additionalProperties: false },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getDescendants = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    Type.Object(
      {
        // SHOW_HIDDEN_PARRAM default value is true so it handles the legacy behavior.
        [SHOW_HIDDEN_PARRAM]: Type.Boolean({ default: true }),
        [TYPES_FILTER_PARAM]: Type.Array(Type.Enum(ItemType)),
      },
      { additionalProperties: false },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getParents = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
