/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import S, { JSONSchema, ObjectSchema } from 'fluent-json-schema';

import { MAX_TARGETS_FOR_MODIFY_REQUEST, MAX_TARGETS_FOR_READ_REQUEST } from '../../util/config';

import { uuid, idParam, idsQuery, error } from '../../schemas/fluent-schema';
import { ITEM_TYPES } from './constants/constants';

/**
 * for serialization
 */
const settings = S.object()
  // allow additional properties mostly for apps custom settings
  .additionalProperties(true)
  .prop('isPinned', S.boolean())
  .prop('tags', S.array())
  .prop('showChatbox', S.boolean())
  .prop('hasThumbnail', S.boolean())
  .prop('ccLicenseAdaption', S.string());

const item = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('description', S.mixed(['string', 'null']))
  .prop('type', S.string())
  .prop('path', S.string())
  .prop('extra', S.object().additionalProperties(true))
  .prop('settings', settings)
  .prop('creator', S.string())
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
const baseItemCreate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern('^\\S+( \\S+)*$'))
  .prop('description', S.string())
  .prop('type', S.const('base'))
  .prop('extra', S.object().additionalProperties(false))
  .prop('settings', settings)
  .required(['name', 'type']);

// type 'folder' (empty extra {})
const folderItemCreate = S.object().prop('type', S.const('folder')).extend(baseItemCreate);

// type 'shortcut' (specific extra)
const shortcutItemExtra = S.object()
  .additionalProperties(false)
  .prop(
    'shortcut',
    S.object().additionalProperties(false).prop('target', uuid).required(['target']),
  )
  .required(['shortcut']);

const shortcutItemCreate = S.object()
  .prop('type', S.const('shortcut'))
  .prop('extra', shortcutItemExtra)
  .required(['extra'])
  .extend(baseItemCreate);

// type 'folder' (specific extra for update)
const folderExtra = S.object()
  // TODO: .additionalProperties(false) in schemas don't seem to work properly and
  // are very counter-intuitive. We should change to JTD format (as soon as it is supported)
  // .additionalProperties(false)
  .prop(
    ITEM_TYPES.FOLDER,
    S.object()
      // .additionalProperties(false)
      .prop('childrenOrder', S.array().items(uuid))
      .required(['childrenOrder']),
  )
  .required([ITEM_TYPES.FOLDER]);

/**
 * for validation on update
 */

const itemUpdate = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern('^\\S+( \\S+)*$'))
  .prop('description', S.string())
  .prop('settings', settings)
  .anyOf([S.required(['name']), S.required(['description'])]);

const create =
  (...itemSchemas: JSONSchema[]) =>
  (itemTypeSchema?: ObjectSchema) => {
    if (itemTypeSchema) itemSchemas.push(itemTypeSchema.extend(baseItemCreate));

    return {
      querystring: S.object().additionalProperties(false).prop('parentId', uuid),
      body: S.object().oneOf(itemSchemas),
      response: { 201: item, '4xx': error },
    };
  };
const initializedCreate = create(baseItemCreate, folderItemCreate, shortcutItemCreate);

const getOne = {
  params: idParam,
  response: { 200: item, '4xx': error },
};

const getMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_READ_REQUEST))
    .extend(idsQuery),
  response: {
    200: S.array().items(S.anyOf([error, item])),
    '4xx': error,
  },
};

const getChildren = {
  params: idParam,
  querystring: S.object().additionalProperties(false).prop('ordered', S.boolean()),
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

const getOwnGetShared = {
  response: {
    200: S.array().items(item),
    '4xx': error,
  },
};

const updateOne =
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
              ]),
            );

    return {
      params: idParam,
      body,
      response: { 200: item, '4xx': error },
    };
  };

const initializedUpdate = updateOne(folderExtra);

const updateMany = () => {
  const { body } = initializedUpdate();

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

const deleteOne = {
  params: idParam,
  response: { 200: item, '4xx': error },
};

const deleteMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  response: {
    200: S.array().items(S.anyOf([error, item])),
    202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': error,
  },
};

const moveOne = {
  params: idParam,
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

const moveMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

const copyOne = {
  params: idParam,
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

const copyMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object().additionalProperties(false).prop('parentId', uuid),
};

export {
  initializedCreate as create,
  getOne,
  getChildren,
  getMany,
  getOwnGetShared,
  initializedUpdate as updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  moveOne,
  moveMany,
  copyOne,
  copyMany,
};
