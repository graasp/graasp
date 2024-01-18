/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import S, { JSONSchema, ObjectSchema } from 'fluent-json-schema';

import {
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  PermissionLevel,
} from '@graasp/sdk';

import { error, idParam, idsQuery, uuid } from '../../schemas/fluent-schema';
import { ITEMS_PAGE_SIZE } from './constants';
import { Ordering, SortBy } from './types';

/**
 * for serialization
 */
const settings = S.object()
  // allow additional properties mostly for apps custom settings
  .additionalProperties(true)
  .prop('isPinned', S.boolean())
  .prop('tags', S.array())
  .prop('showChatbox', S.boolean())
  .prop('isResizable', S.boolean())
  .prop('hasThumbnail', S.boolean())
  .prop('ccLicenseAdaption', S.string())
  .prop('displayCoEditors', S.boolean());

export const partialMember = S.object()
  .additionalProperties(false)
  .prop('id', S.string())
  .prop('name', S.string())
  .prop('email', S.string());

export const item = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('description', S.mixed(['string', 'null']))
  .prop('type', S.string())
  .prop('path', S.string())
  .prop('extra', S.object().additionalProperties(true))
  .prop('settings', settings)
  // creator could have been deleted
  .prop('creator', S.ifThenElse(S.null(), S.null(), partialMember))
  /**
   * for some reason setting these date fields as "type: 'string'"
   * makes the serialization fail using the anyOf.
   */
  .prop('createdAt', S.raw({}))
  .prop('updatedAt', S.raw({}));

/**
 * for validation on create
 */

// type 'base' (empty extra {})
export const baseItemCreate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).maxLength(MAX_ITEM_NAME_LENGTH).pattern('^\\S[ \\S]*$'))
  .prop('description', S.string())
  .prop('type', S.const('base'))
  .prop('extra', S.object().additionalProperties(false))
  .prop('settings', settings)
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
    S.object()
      // .additionalProperties(false)
      .prop('childrenOrder', S.array().items(uuid)),
  )
  .required([ItemType.FOLDER]);

// type 'folder' (empty extra {})
export const folderItemCreate = S.object().prop('type', S.const('folder')).extend(baseItemCreate);

/**
 * for validation on update
 */

export const itemUpdate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern('^\\S+( \\S+)*$'))
  .prop('description', S.string())
  .prop('settings', settings)
  .anyOf([S.required(['name']), S.required(['description']), S.required(['settings'])]);

export const create =
  (...itemSchemas: JSONSchema[]) =>
  (itemTypeSchema?: ObjectSchema) => {
    if (itemTypeSchema) itemSchemas.push(itemTypeSchema.extend(baseItemCreate));

    return {
      querystring: S.object().additionalProperties(false).prop('parentId', uuid),
      body: S.object().oneOf(itemSchemas),
      response: { 201: item, '4xx': error },
    };
  };

export const getOne = {
  params: idParam,
  response: { 200: item, '4xx': error },
};

export const getAccessible = {
  querystring: S.object()
    .prop('page', S.number().default(1))
    .prop('name', S.string())
    .prop('permissions', S.array().items(S.enum(Object.values(PermissionLevel))))
    .prop('sortBy', S.enum(Object.values(SortBy)))
    .prop('ordering', S.enum(Object.values(Ordering)))
    .prop('creatorId', S.string())
    .prop('pageSize', S.number().default(ITEMS_PAGE_SIZE)),
  response: {
    200: S.object()
      .additionalProperties(false)
      .prop('data', S.array().items(item))
      .prop('totalCount', S.number()),
    '4xx': error,
  },
};

export const getMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_READ_REQUEST))
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
  querystring: S.object().additionalProperties(false).prop('ordered', S.boolean()),
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

export const getDescendants = {
  params: idParam,
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

export const getParents = {
  params: idParam,
  response: {
    200: S.array().items(item),
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
                S.required(['description']),
                S.required(['extra']),
                S.required(['settings']),
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

// const deleteOne = {
//   params: idParam,
//   response: { 200: item, '4xx': error },
// };

export const deleteMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  response: {
    202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': error,
  },
};

// const moveOne = {
//   params: idParam,
//   body: S.object().additionalProperties(false).prop('parentId', uuid),
// };

export const moveMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

// const copyOne = {
//   params: idParam,
//   body: S.object().additionalProperties(false).prop('parentId', uuid),
// };

export const copyMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

// ajv for other schemas to import
export default {
  $id: 'http://graasp.org/items/',
  definitions: {
    item: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        type: { type: 'string' },
        path: { type: 'string' },
        extra: {
          type: 'object',
          additionalProperties: true,
        },
        settings: {
          type: 'object',
          additionalProperties: true,
        },
        creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
};
