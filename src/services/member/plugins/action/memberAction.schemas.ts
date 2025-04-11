import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

// schema for removing all actions of a member
export const deleteAllById = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
} as const satisfies FastifySchema;

export const getMemberFilteredActions = {
  querystring: customType.StrictObject({
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
  }),
  response: {
    [StatusCodes.OK]: Type.Object({}, { additionalProperties: true }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
