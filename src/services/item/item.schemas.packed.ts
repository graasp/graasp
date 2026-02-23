import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef, itemTypeSchemaRef } from '../../schemas/global';
import { permissionLevelSchemaRef } from '../../types';
import { nullableMemberSchemaRef } from '../member/member.schemas';
import { ITEMS_PAGE_SIZE } from './constants';
import { appItemSchemaRef } from './plugins/app/app.schemas';
import { documentItemSchemaRef } from './plugins/document/document.schemas';
import { embeddedLinkItemSchemaRef } from './plugins/embeddedLink/link.schemas';
import { etherpadItemSchemaRef } from './plugins/etherpad/etherpad.schemas';
import { fileItemSchemaRef } from './plugins/file/itemFile.schema';
import { folderItemSchemaRef } from './plugins/folder/folder.schemas';
import { h5pExtendedItemSchema, h5pItemSchemaRef } from './plugins/html/h5p/h5p.schemas';
import { itemVisibilitySchemaRef } from './plugins/itemVisibility/itemVisibility.schemas';
import { pageItemSchemaRef } from './plugins/page/page.schemas';
import { shortcutItemSchemaRef } from './plugins/shortcut/shortcut.schemas';
import { Ordering, SortBy } from './types';

export const itemSchema = Type.Union([
  appItemSchemaRef,
  documentItemSchemaRef,
  embeddedLinkItemSchemaRef,
  etherpadItemSchemaRef,
  fileItemSchemaRef,
  folderItemSchemaRef,
  h5pItemSchemaRef,
  pageItemSchemaRef,
  shortcutItemSchemaRef,
]);
export const itemSchemaRef = registerSchemaAsRef('item', 'Item', itemSchema);

const packedSchema = customType.StrictObject({
  creator: nullableMemberSchemaRef,
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
});

export const packedItemSchemaRef = registerSchemaAsRef(
  'packedItem',
  'Packed Item',
  Type.Intersect(
    [
      Type.Union([
        appItemSchemaRef,
        documentItemSchemaRef,
        embeddedLinkItemSchemaRef,
        etherpadItemSchemaRef,
        fileItemSchemaRef,
        folderItemSchemaRef,
        h5pItemSchemaRef,
        pageItemSchemaRef,
        shortcutItemSchemaRef,
      ]),
      packedSchema,
    ],
    {
      discriminator: 'type',
      description: 'Item with additional information for simple display',
    },
  ),
);

export const extendedItemSchemaRef = registerSchemaAsRef(
  'extendedItem',
  'Extended Item',
  Type.Intersect(
    [
      Type.Union([
        appItemSchemaRef,
        documentItemSchemaRef,
        embeddedLinkItemSchemaRef,
        etherpadItemSchemaRef,
        fileItemSchemaRef,
        folderItemSchemaRef,
        h5pExtendedItemSchema,
        pageItemSchemaRef,
        shortcutItemSchemaRef,
      ]),
      packedSchema,
    ],
    {
      discriminator: 'type',
      description: 'Item with extended information useful for complete display',
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
  response: { [StatusCodes.OK]: extendedItemSchemaRef, '4xx': errorSchemaRef },
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
          types: Type.Array(itemTypeSchemaRef),
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
      types: Type.Array(itemTypeSchemaRef),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(extendedItemSchemaRef),
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
      types: Type.Array(itemTypeSchemaRef),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
