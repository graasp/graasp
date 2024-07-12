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
} from '@graasp/sdk';

import { error, idParam, idsQuery, uuid } from '../../schemas/fluent-schema';
import { EMPTY_OR_SPACED_WORDS_REGEX, NAME_REGEX } from '../../schemas/global';
import { ITEMS_PAGE_SIZE } from './constants';
import { Ordering, SortBy } from './types';

export const SHOW_HIDDEN_PARRAM = 'showHidden';
export const TYPES_FILTER_PARAM = 'types';

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
    .prop('name', S.string())
    .prop('permissions', S.array().items(S.enum(Object.values(PermissionLevel))))
    .prop('sortBy', S.enum(Object.values(SortBy)))
    .prop('ordering', S.enum(Object.values(Ordering)))
    .prop('creatorId', S.string())
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

// item tag properties to be returned to the client
export const itemTagType = {
  type: 'string',
  enum: Object.values(ItemTagType),
};
export const itemTag = {
  type: 'object',
  properties: {
    id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    type: itemTagType,
    item: {
      $ref: 'https://graasp.org/items/#/definitions/item',
    },
    creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
    createdAt: { type: 'string' },
  },
  additionalProperties: false,
};

// ajv for other schemas to import
export default {
  $id: 'https://graasp.org/items/',
  definitions: {
    item: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        description: { type: ['string', 'null'] },
        type: { type: 'string' },
        path: { type: 'string' },
        lang: { type: 'string' },
        extra: {
          type: 'object',
          additionalProperties: true,
        },
        settings: {
          type: 'object',
          additionalProperties: true,
        },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
    packedItem: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        description: { type: ['string', 'null'] },
        type: { type: 'string' },
        path: { type: 'string' },
        lang: { type: 'string' },
        extra: {
          type: 'object',
          additionalProperties: true,
        },
        settings: {
          type: 'object',
          additionalProperties: true,
        },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        permission: { type: ['string', 'null'], enum: Object.values(PermissionLevel) },
        hidden: itemTag,
        public: itemTag,
      },
    },
  },
};

export const geolocation = S.object().prop('lat', S.number()).prop('lng', S.number());
