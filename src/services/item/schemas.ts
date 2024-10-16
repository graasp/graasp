import { TObject, TProperties, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  Alignment,
  CCLicenseAdaptions,
  DescriptionPlacement,
  DocumentItemExtraFlavor,
  ItemTagType,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  MaxWidth,
  OldCCLicenseAdaptations,
  PermissionLevel,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { NAME_REGEX, entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { nullableAccountSchemaRef } from '../account/schemas';
import { nullableMemberSchemaRef } from '../member/schemas';
import { ITEMS_PAGE_SIZE } from './constants';
import { Ordering, SortBy } from './types';

export const SHOW_HIDDEN_PARRAM = 'showHidden';
export const TYPES_FILTER_PARAM = 'types';

export const itemIdSchemaRef = registerSchemaAsRef(
  'itemId',
  'Item ID',
  Type.Object(
    {
      // Object Definition
      itemId: customType.UUID(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

const itemSchema = Type.Object(
  {
    // Object Definition
    id: customType.UUID(),
    name: Type.String({ minLength: 1, maxLength: MAX_ITEM_NAME_LENGTH, pattern: NAME_REGEX }),
    displayName: Type.String({ maxLength: MAX_ITEM_NAME_LENGTH }),
    description: Type.Optional(customType.Nullable(Type.String())),
    type: Type.String(),
    path: Type.String(),
    lang: Type.String(),
    extra: Type.Object({}, { additionalProperties: true }),
    settings: Type.Object({}, { additionalProperties: true }),
    creator: Type.Optional(nullableAccountSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    // Schema Options
    additionalProperties: false,
  },
);

export const itemSchemaRef = registerSchemaAsRef('item', 'Item', itemSchema);

// Because packedItemSchemaRef use itemTagSchemaRef which use itemSchemaRef. We need to define itemTagSchemaRef in between, so we can not move it to the ItemTag folder.
export const itemTagSchemaRef = registerSchemaAsRef(
  'itemTag',
  'Item Tag',
  Type.Object(
    {
      id: customType.UUID(),
      type: Type.Enum(ItemTagType),
      item: itemSchemaRef,
      creator: Type.Optional(nullableMemberSchemaRef),
      createdAt: customType.DateTime(),
    },
    {
      additionalProperties: false,
    },
  ),
);

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

const settingsSchema = Type.Partial(
  Type.Object(
    {
      lang: Type.String({ deprecated: true }),
      isPinned: Type.Boolean(),
      tags: Type.Array(Type.String()),
      showChatbox: Type.Boolean(),
      isResizable: Type.Boolean(),
      hasThumbnail: Type.Boolean(),
      ccLicenseAdaption: Type.Union([
        customType.Nullable(customType.EnumString(Object.values(CCLicenseAdaptions))),
        customType.EnumString(Object.values(OldCCLicenseAdaptations), { deprecated: true }),
      ]),
      displayCoEditors: Type.Boolean(),
      descriptionPlacement: customType.EnumString(Object.values(DescriptionPlacement)),
      isCollapsible: Type.Boolean(),
      enableSaveActions: Type.Boolean(),
      // link settings
      showLinkIframe: Type.Boolean(),
      showLinkButton: Type.Boolean(),
      // file settings
      maxWidth: Type.Enum(MaxWidth),
      alignment: Type.Enum(Alignment),
    },
    { additionalProperties: false },
  ),
);

const baseItemCreateSchema = Type.Composite(
  [
    Type.Pick(itemSchema, ['name']),
    Type.Partial(Type.Pick(itemSchema, ['displayName', 'description', 'settings', 'lang'])),
    Type.Object(
      {
        geolocation: Type.Optional(
          Type.Object(
            {
              lat: Type.Number(),
              lng: Type.Number(),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

/**
 * Items' extra field is discriminated by the type field. This function creates a schema for the extra field based on the type field, so the `augmentedItemCreateSchemaRef` can be created.
 * @param literal Item type
 * @param extra Extra object associated with the item type
 * @returns The complete item create schema for the item type
 */
function itemCreateSchemaFactory<L extends string, E extends TProperties>(
  literal: L,
  extra: TObject<E>,
) {
  return Type.Composite(
    [
      Type.Omit(baseItemCreateSchema, ['settings']),
      Type.Object(
        {
          type: Type.Literal(literal),
          settings: Type.Optional(settingsSchema),
          extra: Type.Optional(
            Type.Object({ [literal]: extra } as Record<L, TObject<E>>, {
              additionalProperties: false,
            }),
          ),
        },
        { additionalProperties: false },
      ),
    ],
    { additionalProperties: false },
  );
}

function itemCreateSchemaFactoryWithSettings<
  L extends string,
  E extends TProperties,
  S extends TProperties,
>(literal: L, extra: TObject<E>, settings: TObject<S>) {
  return Type.Composite(
    [
      Type.Omit(itemCreateSchemaFactory(literal, extra), ['settings']),
      Type.Object({ settings }, { additionalProperties: false }),
    ],
    { additionalProperties: false },
  );
}

const emptyExtra = Type.Object({}, { additionalProperties: false });
const fileItemExtra = Type.Object(
  {
    name: Type.String(),
  },
  { additionalProperties: false },
);
const folderItemCreateSchema = itemCreateSchemaFactory(ItemType.FOLDER, emptyExtra);
const appItemCreateSchema = itemCreateSchemaFactory(
  ItemType.APP,
  Type.Object({ url: Type.String({ format: 'uri' }) }, { additionalProperties: false }),
);
const documentItemCreateSchema = itemCreateSchemaFactory(
  ItemType.DOCUMENT,
  Type.Object(
    {
      content: Type.String(),
      flavor: Type.Optional(Type.Enum(DocumentItemExtraFlavor)),
      isRaw: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
);
const linkItemCreateSchema = itemCreateSchemaFactoryWithSettings(
  ItemType.LINK,
  Type.Object(
    {
      url: Type.String({ format: 'uri' }),
      thumbnails: Type.Optional(Type.Array(Type.String())),
      icons: Type.Optional(Type.Array(Type.String())),
      html: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Composite(
    [
      settingsSchema,
      Type.Object(
        {
          showLinkIframe: Type.Optional(Type.Boolean()),
          showLinkButton: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ],
    {
      additionalProperties: false,
    },
  ),
);
const localFileItemCreateSchema = itemCreateSchemaFactory(ItemType.LOCAL_FILE, fileItemExtra);
const s3FileItemCreateSchema = itemCreateSchemaFactory(ItemType.S3_FILE, fileItemExtra);
const etherpadItemCreateSchema = itemCreateSchemaFactory(
  ItemType.ETHERPAD,
  Type.Object({ groupID: Type.String(), padID: Type.String() }, { additionalProperties: false }),
);
const h5pItemCreateSchema = itemCreateSchemaFactory(
  ItemType.H5P,
  Type.Object(
    { contentId: Type.String(), h5pFilePath: Type.String(), contentFilePath: Type.String() },
    { additionalProperties: false },
  ),
);
const shortcutItemCreateSchema = itemCreateSchemaFactory(
  ItemType.SHORTCUT,
  Type.Object({ target: customType.UUID() }, { additionalProperties: false }),
);

export const augmentedItemCreateSchemaRef = registerSchemaAsRef(
  'augmentedItemCreate',
  'Augmented Item Create',
  customType.Discrimineable(
    [
      folderItemCreateSchema,
      appItemCreateSchema,
      documentItemCreateSchema,
      linkItemCreateSchema,
      localFileItemCreateSchema,
      s3FileItemCreateSchema,
      etherpadItemCreateSchema,
      h5pItemCreateSchema,
      shortcutItemCreateSchema,
    ],
    'type',
  ),
);

export const itemUpdateSchemaRef = registerSchemaAsRef(
  'itemUpdate',
  'Item Update',
  Type.Partial(
    Type.Composite(
      [
        Type.Pick(itemSchema, ['name', 'displayName', 'description', 'lang']),
        Type.Object(
          {
            settings: Type.Optional(settingsSchema),
            extra: Type.Union([
              Type.Object(
                {
                  folder: Type.Object({}),
                },
                { additionalProperties: false },
              ),
              Type.Object(
                {
                  app: Type.Object({}),
                },
                { additionalProperties: false },
              ),
              Type.Object(
                {
                  s3File: Type.Object({
                    altText: Type.String(),
                  }),
                },
                { additionalProperties: false },
              ),
              Type.Object(
                {
                  embeddedLink: Type.Object(
                    { url: Type.String() },
                    { additionalProperties: false },
                  ),
                },
                { additionalProperties: false },
              ),
              Type.Object(
                {
                  document: Type.Object(
                    {
                      content: Type.String(),
                      flavor: Type.Optional(Type.Enum(DocumentItemExtraFlavor)),
                      isRaw: Type.Optional(Type.Boolean()),
                    },
                    { additionalProperties: false },
                  ),
                },
                { additionalProperties: false },
              ),
            ]),
          },
          { additionalProperties: false },
        ),
      ],
      {
        additionalProperties: false,
      },
    ),
  ),
);

export const create = {
  querystring: Type.Partial(
    Type.Object(
      { parentId: customType.UUID(), previousItemId: customType.UUID() },
      { additionalProperties: false },
    ),
  ),
  body: augmentedItemCreateSchemaRef,
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const createWithThumbnail = {
  querystring: Type.Partial(
    Type.Object({ parentId: customType.UUID() }, { additionalProperties: false }),
  ),
  response: { [StatusCodes.OK]: itemSchemaRef },
} as const satisfies FastifySchema;

export const getOne = {
  params: entityIdSchemaRef,
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

export const getMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        maxItems: MAX_TARGETS_FOR_READ_REQUEST,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Object({}, { additionalProperties: true }),
      errors: Type.Array(errorSchemaRef),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getChildren = {
  params: entityIdSchemaRef,
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
  params: entityIdSchemaRef,
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
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwn = {
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getShared = {
  querystring: Type.Partial(
    Type.Object({ permission: Type.Enum(PermissionLevel) }, { additionalProperties: false }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  params: entityIdSchemaRef,
  body: itemUpdateSchemaRef,
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  body: itemUpdateSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(Type.Intersect([itemSchemaRef, errorSchemaRef])),
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID()), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const reorder = {
  params: entityIdSchemaRef,
  body: Type.Object({ previousItemId: customType.UUID() }, { additionalProperties: false }),
  response: {
    [StatusCodes.OK]: itemSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID()), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const moveMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  body: Type.Object(
    { parentId: Type.Optional(customType.UUID()) },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

export const copyMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
        uniqueItems: true,
      }),
    },
    { additionalProperties: false },
  ),
  body: Type.Object(
    { parentId: Type.Optional(customType.UUID()) },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;
