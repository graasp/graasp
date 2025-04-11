import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { accountSchemaRef } from '../../../../account/account.schemas';

export const appActionSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    account: accountSchemaRef,
    data: Type.Object({}, { additionalProperties: true }),
    type: Type.String(),
    createdAt: customType.DateTime(),
  },
  {
    description: 'Activity trace saved by an app.',
    additionalProperties: false,
  },
);

export const appActionSchemaRef = registerSchemaAsRef('appAction', 'App Action', appActionSchema);

const appActionLegacySchemaRef = registerSchemaAsRef(
  'appActionLegacy',
  'App Action (legacy)',
  Type.Composite(
    [
      appActionSchema,
      Type.Object(
        {
          member: Type.Ref(accountSchemaRef.$ref, {
            deprecated: true,
            description:
              'Legacy property provided for convenience. Please migrate to using the `account` prop instead.',
          }),
        },
        {},
      ),
    ],
    {
      additionalProperties: false,
      description:
        'App Action supporting legacy apps relying on the presence of the `member` property. It is provided for convenience.',
    },
  ),
);

export const create = {
  operationId: 'createAppAction',
  tags: ['app', 'app-action'],
  summary: 'Create an action happening in an app',
  description: 'Create an action happening in an app given data and type.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: Type.Object({
    data: Type.Object({}, { additionalProperties: true }),
    type: Type.String({ minLength: 3, maxLength: 25 }),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForOne = {
  operationId: 'getAppActionsForApp',
  tags: ['app', 'app-action'],
  summary: 'Get all actions of an app',
  description: 'Get all actions saved for an app.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  querystring: Type.Union([
    customType.StrictObject(
      {
        memberId: customType.UUID(),
      },
      { deprecated: true },
    ),
    customType.StrictObject({
      accountId: customType.UUID(),
    }),
    Type.Object({}, { additionalProperties: false }),
  ]),
  response: {
    [StatusCodes.OK]: Type.Array(appActionLegacySchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
