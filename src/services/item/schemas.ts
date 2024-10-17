import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  Alignment,
  CCLicenseAdaptions,
  DescriptionPlacement,
  DocumentItemExtraFlavor,
  MAX_ITEM_NAME_LENGTH,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  MAX_TARGETS_FOR_READ_REQUEST,
  MaxWidth,
  OldCCLicenseAdaptations,
  PermissionLevel,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { NAME_REGEX, entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { nullableAccountSchemaRef } from '../account/schemas';

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

export const itemSchema = Type.Object(
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

export const settingsSchema = Type.Partial(
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

export const createWithThumbnail = {
  querystring: Type.Partial(
    Type.Object({ parentId: customType.UUID() }, { additionalProperties: false }),
  ),
  response: { [StatusCodes.OK]: itemSchemaRef },
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
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
    }),
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
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
    }),
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
