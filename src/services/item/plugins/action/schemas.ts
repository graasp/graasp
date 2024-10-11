import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  CountGroupBy,
  ExportActionsFormatting,
} from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';
import {
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from '../../../action/constants/constants';
import { ItemActionType } from './utils';

// schema for getting item analytics with view and requestedSampleSize query parameters
export const getItemActions = {
  params: entityIdSchemaRef,
  querystring: Type.Object(
    {
      requestedSampleSize: Type.Number({
        minimum: MIN_ACTIONS_SAMPLE_SIZE,
        maximum: MAX_ACTIONS_SAMPLE_SIZE,
      }),
      view: Type.String(),
      startDate: Type.Optional(Type.String({ format: 'date-time' })),
      endDate: Type.Optional(Type.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

// schema for getting aggregation of actions
export const getAggregateActions = {
  params: entityIdSchemaRef,
  querystring: Type.Object(
    {
      requestedSampleSize: Type.Number({
        minimum: MIN_ACTIONS_SAMPLE_SIZE,
        maximum: MAX_ACTIONS_SAMPLE_SIZE,
      }),
      view: Type.String(),
      type: Type.Optional(Type.Array(Type.String())),
      countGroupBy: Type.Array(Type.Enum(CountGroupBy)),
      aggregateFunction: Type.Enum(AggregateFunction),
      aggregateMetric: Type.Enum(AggregateMetric),
      aggregateBy: Type.Optional(Type.Array(Type.Enum(AggregateBy))),
      startDate: Type.Optional(Type.String({ format: 'date-time' })),
      endDate: Type.Optional(Type.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Array(
      Type.Object(
        {
          aggregateResult: Type.Number(),
          createdTimeOfDay: Type.Optional(Type.String()),
          actionType: Type.Optional(Type.Enum(ItemActionType)),
          createdDay: Type.Optional(customType.DateTime()),
        },
        { additionalProperties: false },
      ),
    ),
  },
} as const satisfies FastifySchema;

export const exportAction = {
  params: entityIdSchemaRef,
  querystring: Type.Partial(
    Type.Object({ format: Type.Enum(ExportActionsFormatting) }, { additionalProperties: false }),
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;

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
  params: entityIdSchemaRef,
  body: Type.Object(
    {
      type: Type.String(),
      extra: Type.Optional(Type.Object({}, { additionalProperties: true })),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: {},
  },
} as const satisfies FastifySchema;
