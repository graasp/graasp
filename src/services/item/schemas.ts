import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  Alignment,
  CCLicenseAdaptions,
  DescriptionPlacement,
  DocumentItemExtraFlavor,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  MaxWidth,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox.js';
import { errorSchemaRef } from '../../schemas/global.js';
import { nullableAccountSchemaRef } from '../account/schemas.js';

export const settingsSchema = Type.Partial(
  customType.StrictObject(
    {
      lang: Type.String({ deprecated: true }),
      isPinned: Type.Boolean(),
      /**
       * @deprecated use entities tags and item tags instead
       */
      tags: Type.Array(Type.String(), { deprecated: true }),
      showChatbox: Type.Boolean(),
      isResizable: Type.Boolean(),
      hasThumbnail: Type.Boolean(),
      ccLicenseAdaption: customType.Nullable(
        customType.EnumString(Object.values(CCLicenseAdaptions)),
      ),
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
      Type.Pick(itemSchema, ['name', 'description', 'lang']),
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
    previousItemId: Type.Optional(
      customType.UUID({
        description:
          'Item which the item defined in params should go after. If not defined, the item will become the first child of its parent.',
      }),
    ),
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
