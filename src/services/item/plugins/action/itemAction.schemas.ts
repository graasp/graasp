import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  ActionTriggers,
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  CountGroupBy,
  ExportActionsFormatting,
  UnionOfConst,
} from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
// import { nullableAccountSchemaRef } from '../../../account/account.schemas';
import { MAX_ACTIONS_SAMPLE_SIZE, MIN_ACTIONS_SAMPLE_SIZE } from '../../../action/constants';
import { itemSchemaRef } from '../../item.schemas';
// import { itemSchema } from '../../item.schemas';
import { ItemActionType } from './utils';

export const View = {
  Builder: 'builder',
  Player: 'player',
  Library: 'library',
  Explorer: 'explorer',
  Account: 'account',
  Auth: 'auth',
  Unknown: 'unknown',
} as const;
const ViewValues = Object.values(View);
export type ViewOptions = UnionOfConst<typeof View>;

const actionSchema = customType.StrictObject({
  id: customType.UUID(),
  // account: Type.Optional(nullableAccountSchemaRef),
  accountId: customType.Nullable(customType.UUID()),
  item: customType.Nullable(Type.Omit(itemSchemaRef, ['creator'])),
  view: customType.EnumString(ViewValues),
  type: Type.String(),
  extra: Type.Object({}),
  geolocation: Type.Optional(customType.Nullable(Type.Object({}))),
  createdAt: customType.DateTime(),
});

// schema for getting item analytics with view and requestedSampleSize query parameters
export const getItemActions = {
  operationId: 'getItemActions',
  tags: ['action'],
  summary: 'Get actions for item and its descendants',
  description: 'Get actions generated by users for the given item and its descendants.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    requestedSampleSize: Type.Optional(
      Type.Number({
        minimum: MIN_ACTIONS_SAMPLE_SIZE,
        maximum: MAX_ACTIONS_SAMPLE_SIZE,
      }),
    ),
    view: Type.Optional(customType.EnumString(ViewValues)),
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(actionSchema),
    // TODO: enable back
    // [StatusCodes.OK]: customType.StrictObject({
    //   actions: Type.Array(actionSchema),
    //   members: Type.Array(accountSchemaRef),
    //   descendants: Type.Array(itemSchemaRef),
    //   item: itemSchemaRef,
    //   apps: Type.Record(
    //     customType.UUID(),
    //     customType.StrictObject({
    //       data: Type.Array(appDataSchemaRef),
    //       settings: Type.Array(appSettingSchemaRef),
    //       actions: Type.Array(appActionSchemaRef),
    //     }),
    //   ),
    //   metadata: customType.StrictObject({
    //     numActionsRetrieved: Type.Number(),
    //     requestedSampleSize: Type.Number(),
    //   }),
    // }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getItemActionsByHour = {
  operationId: 'getItemActionsByHour',
  tags: ['action'],
  // summary: 'Get actions for item and its descendants',
  // description: 'Get actions generated by users for the given item and its descendants.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    // requestedSampleSize: Type.Optional(
    //   Type.Number({
    //     minimum: MIN_ACTIONS_SAMPLE_SIZE,
    //     maximum: MAX_ACTIONS_SAMPLE_SIZE,
    //   }),
    // ),
    // view: Type.Optional(Type.Enum(Context)),
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  }),
  response: {
    // [StatusCodes.OK]: {},
    // TODO: enable back
    // [StatusCodes.OK]: customType.StrictObject({
    //   actions: Type.Array(actionSchema),
    //   members: Type.Array(accountSchemaRef),
    //   descendants: Type.Array(itemSchemaRef),
    //   item: itemSchemaRef,
    //   apps: Type.Record(
    //     customType.UUID(),
    //     customType.StrictObject({
    //       data: Type.Array(appDataSchemaRef),
    //       settings: Type.Array(appSettingSchemaRef),
    //       actions: Type.Array(appActionSchemaRef),
    //     }),
    //   ),
    //   metadata: customType.StrictObject({
    //     numActionsRetrieved: Type.Number(),
    //     requestedSampleSize: Type.Number(),
    //   }),
    // }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getItemActionsByDay = {
  operationId: 'getItemActionsByDay',
  tags: ['action'],
  // summary: 'Get actions for item and its descendants',
  // description: 'Get actions generated by users for the given item and its descendants.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    // requestedSampleSize: Type.Optional(
    //   Type.Number({
    //     minimum: MIN_ACTIONS_SAMPLE_SIZE,
    //     maximum: MAX_ACTIONS_SAMPLE_SIZE,
    //   }),
    // ),
    // view: Type.Optional(Type.Enum(Context)),
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  }),
  response: {
    // [StatusCodes.OK]: {},
    // TODO: enable back
    // [StatusCodes.OK]: customType.StrictObject({
    //   actions: Type.Array(actionSchema),
    //   members: Type.Array(accountSchemaRef),
    //   descendants: Type.Array(itemSchemaRef),
    //   item: itemSchemaRef,
    //   apps: Type.Record(
    //     customType.UUID(),
    //     customType.StrictObject({
    //       data: Type.Array(appDataSchemaRef),
    //       settings: Type.Array(appSettingSchemaRef),
    //       actions: Type.Array(appActionSchemaRef),
    //     }),
    //   ),
    //   metadata: customType.StrictObject({
    //     numActionsRetrieved: Type.Number(),
    //     requestedSampleSize: Type.Number(),
    //   }),
    // }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getItemActionsByWeekday = {
  operationId: 'getItemActionsByWeekday',
  tags: ['action'],
  // summary: 'Get actions for item and its descendants',
  // description: 'Get actions generated by users for the given item and its descendants.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    // requestedSampleSize: Type.Optional(
    //   Type.Number({
    //     minimum: MIN_ACTIONS_SAMPLE_SIZE,
    //     maximum: MAX_ACTIONS_SAMPLE_SIZE,
    //   }),
    // ),
    // view: Type.Optional(Type.Enum(Context)),
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  }),
  response: {
    // [StatusCodes.OK]: {},
    // TODO: enable back
    // [StatusCodes.OK]: customType.StrictObject({
    //   actions: Type.Array(actionSchema),
    //   members: Type.Array(accountSchemaRef),
    //   descendants: Type.Array(itemSchemaRef),
    //   item: itemSchemaRef,
    //   apps: Type.Record(
    //     customType.UUID(),
    //     customType.StrictObject({
    //       data: Type.Array(appDataSchemaRef),
    //       settings: Type.Array(appSettingSchemaRef),
    //       actions: Type.Array(appActionSchemaRef),
    //     }),
    //   ),
    //   metadata: customType.StrictObject({
    //     numActionsRetrieved: Type.Number(),
    //     requestedSampleSize: Type.Number(),
    //   }),
    // }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const exportActions = {
  operationId: 'exportActions',
  tags: ['action'],
  summary: 'Send request to export actions',
  description:
    'Send request to export actions for given item. The user receives an email with a download link. The generated export is available for a week, and can be generated only once a day.',

  params: customType.StrictObject({
    id: customType.UUID({ description: 'Item id whose actions will be exported.' }),
  }),
  querystring: Type.Partial(
    customType.StrictObject({ format: Type.Enum(ExportActionsFormatting) }),
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const postAction = {
  operationId: 'postAction',
  tags: ['action'],
  summary: 'Save action for item',
  description: 'Save action for item with given type and extra.',

  params: customType.StrictObject({
    id: customType.UUID({ description: 'The new action will be saved for this item id.' }),
  }),
  body: customType.StrictObject({
    type: Type.String(),
    extra: Type.Optional(Type.Object({}, { additionalProperties: true })),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
