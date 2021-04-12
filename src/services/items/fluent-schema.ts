/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import S, { JSONSchema, ObjectSchema } from 'fluent-json-schema';

import {
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST
} from '../../util/config';

import { uuid, idParam, idsQuery, error } from '../../schemas/fluent-schema';

/**
 * for serialization
 */
const item = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('description', S.mixed(['string', 'null']))
  .prop('type', S.string())
  .prop('path', S.string())
  .prop('extra', S.object().additionalProperties(true))
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

// type 'base', empty extra {}
const partialBaseItem = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern('^\\S+( \\S+)*$'))
  .prop('description', S.string())
  .prop('type', S.const('base'))
  .prop('extra', S.object().additionalProperties(false))
  .required(['name', 'type']);

// type 'folder', empty extra {}
const partialFolderItem = S.object()
  .prop('type', S.const('folder'))
  .extend(partialBaseItem);

/**
 * for validation on update
 */
const partialItemRequireOne = S.object()
  .additionalProperties(false)
  .prop('name', S.string().minLength(1).pattern('^\\S+( \\S+)*$'))
  .prop('description', S.string())
  .prop('extra', S.object())
  .anyOf([
    S.required(['name']),
    S.required(['description']),
    S.required(['extra'])
  ]);

const create = (...itemSchemas: JSONSchema[]) => (itemTypeSchema?: ObjectSchema) => {
  if (itemTypeSchema) itemSchemas.push(itemTypeSchema.extend(partialBaseItem));

  return {
    querystring: S.object().additionalProperties(false).prop('parentId', uuid),
    body: S.object().oneOf(itemSchemas),
    response: { 201: item, '4xx': error }
  };
};
const initializedCreate = create(partialBaseItem, partialFolderItem);

const getOne = {
  params: idParam,
  response: { 200: item, '4xx': error }
};

const getMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_READ_REQUEST))
    .extend(idsQuery),
  response: {
    200: S.array().items(S.anyOf([error, item])),
    '4xx': error
  }
};

const getChildren = {
  params: idParam,
  response: {
    200: S.array().items(item),
    '4xx': error
  }
};

const getOwnGetShared = {
  response: {
    200: S.array().items(item),
    '4xx': error
  }
};

const updateOne = (...otherItemExtraSchemas: ObjectSchema[]) => {
  return {
    params: idParam,
    body: S.object()
      .prop('extra', S.oneOf(otherItemExtraSchemas))
      .extend(partialItemRequireOne),
    response: { 200: item, '4xx': error }
  };
};

const updateMany = (...otherItemExtraSchemas: ObjectSchema[]) => {
  return {
    querystring: S.object()
      .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
      .extend(idsQuery),
    body: S.object()
      .prop('extra', S.oneOf(otherItemExtraSchemas))
      .extend(partialItemRequireOne),
    response: {
      200: S.array().items(S.anyOf([error, item])),
      202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      '4xx': error
    }
  };
};

const deleteOne = {
  params: idParam,
  response: { 200: item, '4xx': error }
};

const deleteMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  response: {
    200: S.array().items(S.anyOf([error, item])),
    202: S.array().items(uuid), // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
    '4xx': error
  }
};

const moveOne = {
  params: idParam,
  body: S.object()
    .additionalProperties(false)
    .prop('parentId', uuid),
};

const moveMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object()
    .additionalProperties(false)
    .prop('parentId', uuid)
};

const copyOne = {
  params: idParam,
  body: S.object()
    .additionalProperties(false)
    .prop('parentId', uuid)
};

const copyMany = {
  querystring: S.object()
    .prop('id', S.array().maxItems(MAX_TARGETS_FOR_MODIFY_REQUEST))
    .extend(idsQuery),
  body: S.object()
    .additionalProperties(false)
    .prop('parentId', uuid)
};

export {
  initializedCreate as create,
  getOne,
  getChildren,
  getMany,
  getOwnGetShared,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  moveOne,
  moveMany,
  copyOne,
  copyMany
};
