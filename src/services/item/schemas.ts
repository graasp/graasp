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
  MaxWidth,
  OldCCLicenseAdaptations,
  PermissionLevel,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { nullableAccountSchemaRef } from '../account/schemas';

export const settingsSchema = Type.Partial(
  customType.StrictObject(
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
    {
      title: 'Item settings',
      description: 'Parameters, mostly visual, common to all types of items.',
    },
  ),
);

export const itemSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: customType.ItemName(),
    displayName: Type.String({ maxLength: MAX_ITEM_NAME_LENGTH }),
    description: Type.Optional(customType.Nullable(Type.String())),
    type: Type.String(),
    path: Type.String(),
    lang: Type.String(),
    extra: Type.Object({}, { additionalProperties: true }),
    settings: settingsSchema,
    creator: Type.Optional(nullableAccountSchemaRef),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  },
  {
    title: 'Item',
    description: 'Smallest unit of a learning collection',
  },
);

export const itemSchemaRef = registerSchemaAsRef('item', 'Item', itemSchema);

export const itemUpdateSchema = Type.Partial(
  Type.Composite(
    [
      Type.Pick(itemSchema, ['name', 'displayName', 'description', 'lang']),
      customType.StrictObject({
        settings: Type.Optional(settingsSchema),
        extra: Type.Union([
          customType.StrictObject({
            folder: Type.Object({}),
          }),
          customType.StrictObject({
            app: Type.Object({}),
          }),
          customType.StrictObject({
            s3File: Type.Object({
              altText: Type.String(),
            }),
          }),
          customType.StrictObject({
            file: Type.Object({
              altText: Type.String(),
            }),
          }),
          customType.StrictObject({
            embeddedLink: customType.StrictObject({ url: Type.String() }),
          }),
          customType.StrictObject({
            document: customType.StrictObject({
              content: Type.String(),
              flavor: Type.Optional(Type.Enum(DocumentItemExtraFlavor)),
              isRaw: Type.Optional(Type.Boolean()),
            }),
          }),
        ]),
      }),
    ],
    {
      additionalProperties: false,
    },
  ),
);

export const getOwn = {
  // use GET accessible
  deprecated: true,

  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getShared = {
  // use GET accessible
  deprecated: true,

  querystring: Type.Partial(customType.StrictObject({ permission: Type.Enum(PermissionLevel) })),
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  operationId: 'updateItem',
  tags: ['item'],
  summary: 'Update item',
  description: 'Update item given body.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: itemUpdateSchema,
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const reorder = {
  operationId: 'reorderItem',
  tags: ['item'],
  summary: 'Reorder item',
  description: 'Reorder item within its parent given previous item id.',

  params: customType.StrictObject({
    id: customType.UUID({ description: 'Item to reorder' }),
  }),
  body: customType.StrictObject({
    previousItemId: customType.UUID({
      description: 'Item which the item defined in params should go after',
    }),
  }),
  response: {
    [StatusCodes.OK]: itemSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteMany = {
  operationId: 'deleteManyItems',
  tags: ['item'],
  summary: 'Delete many items',
  description:
    'Delete many items given their ids. This endpoint is asynchronous and a feedback is returned through websockets.',

  querystring: customType.StrictObject({
    id: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
      uniqueItems: true,
    }),
  }),
  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const moveMany = {
  operationId: 'moveManyItems',
  tags: ['item'],
  summary: 'Move many items',
  description:
    'Move many items given their ids to a parent target. This endpoint is asynchronous and a feedback is returned through websockets.',

  querystring: customType.StrictObject({
    id: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
      uniqueItems: true,
      description: 'Ids of the items to move',
    }),
  }),
  body: customType.StrictObject({
    parentId: Type.Optional(
      customType.UUID({ description: 'Parent item id where to move the items' }),
    ),
  }),
  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const copyMany = {
  operationId: 'copyManyItems',
  tags: ['item'],
  summary: 'Copy many items',
  description:
    'Copy many items given their ids in a parent target. This endpoint is asynchronous and a feedback is returned through websockets.',

  querystring: customType.StrictObject({
    id: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST,
      uniqueItems: true,
      description: 'Ids of the items to move',
    }),
  }),
  body: customType.StrictObject({
    parentId: Type.Optional(
      customType.UUID({ description: 'Parent item id where the items are copied' }),
    ),
  }),
  response: {
    [StatusCodes.ACCEPTED]: Type.Array(customType.UUID(), {
      maxItems: MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
