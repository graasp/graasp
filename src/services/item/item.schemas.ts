import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import {
  DocumentItemExtraFlavor,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
} from '@graasp/sdk';

import { customType } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { genericItemSchema, itemCommonSchema, settingsSchema } from './common.schemas';

export const itemUpdateSchema = Type.Partial(
  Type.Composite(
    [
      Type.Pick(itemCommonSchema, ['name', 'description', 'lang']),
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
            file: Type.Object({
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

export const getParentItems = {
  operationId: 'getParentItems',
  tags: ['item'],
  summary: 'Get parents of item',
  description: 'Get parent items of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(
      customType.StrictObject({ id: Type.String(), name: Type.String(), path: Type.String() }),
    ),
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
  response: { [StatusCodes.OK]: genericItemSchema, '4xx': errorSchemaRef },
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
    [StatusCodes.OK]: genericItemSchema,
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
