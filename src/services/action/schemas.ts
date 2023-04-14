import S from 'fluent-json-schema';
import { StatusCodes } from 'http-status-codes';

import { MAX_ACTIONS_SAMPLE_SIZE, MIN_ACTIONS_SAMPLE_SIZE } from '../item/plugins/action/utils';

// todo: get from graasp-utils
export const uuid = S.string().pattern(
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

export const id = S.object().prop('id', uuid).required(['id']);

const item = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('name', S.string())
  .prop('description', S.mixed(['string', 'null']))
  .prop('type', S.string())
  .prop('path', S.string())
  .prop('extra', S.object().additionalProperties(true))
  .prop('settings', S.object())
  .prop('creator', S.string())
  /**
   * for some reason setting these date fields as "type: 'string'"
   * makes the serialization fail using the anyOf.
   */
  .prop('createdAt', S.raw({}))
  .prop('updatedAt', S.raw({}));

// todo: complete schema
export const baseAnalytics = S.object()
  .prop('actions', S.array())
  .prop('descendants', S.array().items(item))
  .prop('item', item)
  .prop('itemMemberships', S.array())
  .prop('members', S.array())
  .prop('metadata', S.object())
  .required(['item', 'actions', 'itemMemberships', 'members', 'metadata']);

// schema for getting item analytics with view and requestedSampleSize query parameters
export const getItemActions = {
  params: id,
  querystring: {
    requestedSampleSize: {
      type: 'number',
      required: ['requestedSampleSize'],
      minimum: MIN_ACTIONS_SAMPLE_SIZE,
      maximum: MAX_ACTIONS_SAMPLE_SIZE,
    },
    view: {
      type: 'string',
      required: ['view'],
    },
  },
  response: {},
};

// schema for removing all actions of a member
export const deleteAllById = {
  params: id,
};

export const exportAction = {
  params: id,
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
};

const memberSchema = {
  // copy of member's schema
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    extra: {
      type: 'object',
      additionalProperties: false,
      properties: { lang: { type: 'string' } },
    },
  },
};

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    path: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    deletedAt: { type: 'string' },
    type: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    creator: memberSchema,
    // TODO
    extra: {
      type: 'object',
      additionalProperties: true,
    },
    settings: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

export const memberSchemaForAnalytics = {
  type: 'array',
  items: memberSchema,
};


export const itemSchemaForAnalytics = itemSchema;


export const descendantsSchemaForAnalytics = {
  type: 'array',
  items: itemSchema
};

export const actionsSchemaForAnalytics = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      view: { type: 'string' },
      type: { type: 'string' },
      createdAt: { type: 'string' },
      geolocation: {
        type: 'object',
        additionalProperties: true,
      },
      item: itemSchema,
      member: memberSchema
    },
  }
};
