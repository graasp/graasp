import S from 'fluent-json-schema';
import { StatusCodes } from 'http-status-codes';

import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy } from '@graasp/sdk';

import { idParam } from '../../../../schemas/fluent-schema';
import { item } from '../../fluent-schema';
import { MAX_ACTIONS_SAMPLE_SIZE, MIN_ACTIONS_SAMPLE_SIZE } from './utils';

// todo: complete schema
export const baseAnalytics = S.object()
  .prop('actions', S.array())
  .prop('descendants', S.array().items(item))
  .prop('item', item)
  .prop('itemMemberships', S.array())
  .prop('members', S.array())
  .prop(
    'apps',
    S.object()
      .additionalProperties(false)
      .prop('actions', S.array())
      .prop('settings', S.array())
      .prop('data', S.array()),
  )
  .prop('metadata', S.object())
  .required(['item', 'actions', 'itemMemberships', 'members', 'metadata', 'apps']);

// schema for getting item analytics with view and requestedSampleSize query parameters
export const getItemActions = {
  params: idParam,
  querystring: {
    type: 'object',
    properties: {
      requestedSampleSize: {
        type: 'number',
        minimum: MIN_ACTIONS_SAMPLE_SIZE,
        maximum: MAX_ACTIONS_SAMPLE_SIZE,
      },
      view: {
        type: 'string',
      },
    },
    required: ['view', 'requestedSampleSize'],
  },
};

// schema for getting aggregation of actions
export const getAggregateActions = {
  params: idParam,
  querystring: {
    type: 'object',
    properties: {
      requestedSampleSize: {
        type: 'number',
        minimum: MIN_ACTIONS_SAMPLE_SIZE,
        maximum: MAX_ACTIONS_SAMPLE_SIZE,
      },
      view: {
        type: 'string',
      },
      type: {
        type: 'array',
        items: { type: 'string' },
      },
      countGroupBy: {
        type: 'array',
        items: {
          type: 'string',
          enum: Object.values(CountGroupBy),
        },
      },
      aggregateFuction: {
        type: 'string',
        enum: Object.values(AggregateFunction),
      },
      aggregateMetric: {
        type: 'string',
        enum: Object.values(AggregateMetric),
      },
      aggregateBy: {
        type: 'array',
        items: {
          type: 'string',
          enum: Object.values(AggregateBy),
        },
      },
    },
    required: [
      'view',
      'requestedSampleSize',
      'countGroupBy',
      'aggregateFunction',
      'aggregateMetric',
    ],
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          aggregateResult: { type: 'number' },
        },
        required: ['aggregateResult'],
      },
    },
  },
};

export const exportAction = {
  params: idParam,
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
};

export const memberSchema = {
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

export const memberSchemaForAnalytics = {
  type: 'array',
  items: memberSchema,
};

export const postAction = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      extra: { type: 'object' },
    },
    required: ['type'],
  },
  response: {
    200: {},
  },
};
