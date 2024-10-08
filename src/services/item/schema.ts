import { Type } from '@sinclair/typebox';
import { JSONSchema, ObjectSchema, S } from 'fluent-json-schema';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  Alignment,
  DescriptionPlacement,
  ItemTagType,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  MaxWidth,
  PermissionLevel,
  ThumbnailSizeInPackedItem,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { error, idParam, idsQuery, uuid } from '../../schemas/fluent-schema';
import { EMPTY_OR_SPACED_WORDS_REGEX, NAME_REGEX } from '../../schemas/global';
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

export const itemSchemaRef = registerSchemaAsRef(
  'item',
  'Item',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      name: Type.String(),
      displayName: Type.String(),
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
  ),
);

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
      permission: Type.Union([Type.Enum(PermissionLevel), Type.Null()]),
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

/**
 * for serialization
 */
export const settings = S.object()
  // Setting additional properties to false will only filter out invalid properties.
  .additionalProperties(false)
  // lang is deprecated
  .prop('lang', S.string())
  .prop('isPinned', S.boolean())
  .prop('tags', S.array())
  .prop('showChatbox', S.boolean())
  .prop('isResizable', S.boolean())
  .prop('hasThumbnail', S.boolean())
  .prop('ccLicenseAdaption', S.string())
  .prop('displayCoEditors', S.boolean())
  .prop('descriptionPlacement', S.enum(Object.values(DescriptionPlacement)))
  .prop('isCollapsible', S.boolean())
  .prop('enableSaveActions', S.boolean())
  // link settings
  .prop('showLinkIframe', S.boolean())
  .prop('showLinkButton', S.boolean())
  // file settings
  .prop('maxWidth', S.enum(Object.values(MaxWidth)))
  .prop('alignment', S.enum(Object.values(Alignment)));

export const partialMember = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('email', S.string().format('email'));

export const item = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('displayName', S.string())
  .prop('description', S.mixed(['string', 'null']))
  .prop('type', S.string())
  .prop('path', S.string())
  .prop('extra', S.object().additionalProperties(true))
  .prop('settings', settings)
  .prop('lang', S.string())
  // creator could have been deleted
  .prop('creator', S.ifThenElse(S.not(S.null()), partialMember, S.null()))
  /**
   * for some reason setting these date fields as "type: 'string'"
   * makes the serialization fail using the anyOf.
   */
  .prop('createdAt', S.string().format('date-time'))
  .prop('updatedAt', S.string().format('date-time'));

export const packedItem = item
  .prop('permission', S.oneOf([S.null(), S.enum(Object.values(PermissionLevel))]))
  // TODO
  .prop(
    'hidden',
    S.object()
      .prop('id', S.string())
      .prop('createdAt', S.string())
      .prop('type', S.string())
      .prop('item', item),
  )
  .prop(
    'public',
    S.object()
      .prop('id', S.string())
      .prop('createdAt', S.string())
      .prop('type', S.string())
      .prop('item', item),
  )
  .prop(
    'thumbnails',
    S.oneOf([
      S.null(),
      S.object()
        .prop(ThumbnailSizeInPackedItem.small, S.string())
        .prop(ThumbnailSizeInPackedItem.medium, S.string()),
    ]),
  );
/**
 * for validation on create
 */
// type 'base' (empty extra {})
export const baseItemCreate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).maxLength(MAX_ITEM_NAME_LENGTH).pattern(NAME_REGEX))
  .prop(
    'displayName',
    S.string().maxLength(MAX_ITEM_NAME_LENGTH).pattern(EMPTY_OR_SPACED_WORDS_REGEX),
  )
  .prop('description', S.string())
  .prop('type', S.const('base'))
  .prop('extra', S.object().additionalProperties(false))
  .prop('settings', settings)
  .prop('lang', S.string())
  .prop(
    'geolocation',
    S.object().prop('lat', S.number()).prop('lng', S.number()).required(['lat', 'lng']),
  )
  .required(['name', 'type']);

// type 'shortcut' (specific extra)
const shortcutItemExtra = S.object()
  .additionalProperties(false)
  .prop(
    'shortcut',
    S.object().additionalProperties(false).prop('target', uuid).required(['target']),
  )
  .required(['shortcut']);

export const shortcutItemCreate = S.object()
  .prop('type', S.const('shortcut'))
  .prop('extra', shortcutItemExtra)
  .required(['extra'])
  .extend(baseItemCreate);

// type 'folder' (specific extra for update)
export const folderExtra = S.object()
  // TODO: .additionalProperties(false) in schemas don't seem to work properly and
  // are very counter-intuitive. We should change to JTD format (as soon as it is supported)
  // .additionalProperties(false)
  .prop(
    ItemType.FOLDER,
    S.object(),
    // .additionalProperties(false)
  )
  .required([ItemType.FOLDER]);

// type 'folder' (empty extra {})
export const folderItemCreate = S.object().prop('type', S.const('folder')).extend(baseItemCreate);

/**
 * for validation on update
 */
export const itemUpdate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern(NAME_REGEX))
  .prop('displayName', S.string().pattern(EMPTY_OR_SPACED_WORDS_REGEX))
  .prop('description', S.string())
  .prop('lang', S.string())
  .prop('settings', settings)
  .anyOf([
    S.required(['displayName']),
    S.required(['name']),
    S.required(['description']),
    S.required(['settings']),
    S.required(['lang']),
  ]);

export const create =
  (...itemSchemas: JSONSchema[]) =>
  (itemTypeSchema?: ObjectSchema) => {
    if (itemTypeSchema) itemSchemas.push(itemTypeSchema.extend(baseItemCreate));

    return {
      querystring: S.object()
        .additionalProperties(false)
        .prop('parentId', uuid)
        .prop('previousItemId', uuid),
      body: S.object().oneOf(itemSchemas),
      response: { '2xx': item, '4xx': error },
    };
  };

export const getOne: FastifySchema = {
  params: idParam,
  response: { 200: packedItem, '4xx': error },
};

export const getAccessible: FastifySchema = {
  querystring: S.object()
    .prop('page', S.number().default(1))
    .prop('permissions', S.array().items(S.enum(Object.values(PermissionLevel))))
    .prop('sortBy', S.enum(Object.values(SortBy)))
    .prop('ordering', S.enum(Object.values(Ordering)))
    .prop('creatorId', S.string())
    .prop('keywords', S.array().items(S.string()))
    .prop('pageSize', S.number().default(ITEMS_PAGE_SIZE))
    .prop('types', S.array().items(S.enum(Object.values(ItemType)))),
  response: {
    200: S.object()
      .additionalProperties(false)
      .prop('data', S.array().items(packedItem))
      .prop('totalCount', S.number()),
    '4xx': error,
  },
};

export const getMany: FastifySchema = {
  querystring: S.object()
    .prop('id', S.array().minItems(1).maxItems(MAX_TARGETS_FOR_READ_REQUEST))
    .extend(idsQuery),
  response: {
    200: S.object()
      .additionalProperties(false)
      .prop('data', S.object().additionalProperties(true)) // TODO
      .prop('errors', S.array().items(error)),
    '4xx': error,
  },
};

export const getChildren = {
  params: idParam,
  querystring: S.object()
    .additionalProperties(false)
    .prop('ordered', S.boolean().default(true))
    .prop('keywords', S.array().items(S.string()))
    .prop('types', S.array().items(S.enum(Object.values(ItemType)))),
  response: {
    200: S.array().items(packedItem),
    '4xx': error,
  },
};

export const getDescendants: FastifySchema = {
  params: idParam,
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      [SHOW_HIDDEN_PARRAM]: { type: 'boolean', default: true },
      [TYPES_FILTER_PARAM]: {
        type: 'array',
        items: { type: 'string', enum: Object.values(ItemType) },
      },
    },
  },
  response: {
    [StatusCodes.OK]: S.array().items(packedItem),
    '4xx': error,
  },
};

export const getParents = {
  params: idParam,
  response: {
    200: S.array().items(packedItem),
    '4xx': error,
  },
};

export const getOwn = {
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

export const getShared = {
  querystring: S.object().additionalProperties(false).prop('permission', S.string()),
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

export const updateOne =
  (...itemExtraSchemas: JSONSchema[]) =>
  (itemExtraSchema?: ObjectSchema) => {
    if (itemExtraSchema) itemExtraSchemas.push(itemExtraSchema);

    const body =
      itemExtraSchemas.length === 0
        ? itemUpdate
        : S.object()
            .prop('extra', S.oneOf(itemExtraSchemas))
            .extend(
              itemUpdate.anyOf([
                S.required(['name']),
                S.required(['displayName']),
                S.required(['description']),
                S.required(['extra']),
                S.required(['settings']),
                S.required(['lang']),
              ]),
            );

    return {
      params: idParam,
      body,
      response: { 200: item, '4xx': error },
    };
  };

export const updateMany = ({ body }) => {
  return {
    querystring: S.object()
      .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
      .extend(idsQuery),
    body,
    response: {
      200: S.array().items(S.anyOf([error, item])),
      202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      '4xx': error,
    },
  };
};

export const reorder = {
  params: S.object().prop('id', uuid),
  body: S.object().additionalProperties(false).prop('previousItemId', uuid),

  response: {
    [StatusCodes.OK]: item,
    '4xx': error,
  },
};

export const deleteMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  response: {
    202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': error,
  },
};

export const moveMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

export const copyMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

export const geolocation = S.object().prop('lat', S.number()).prop('lng', S.number());
