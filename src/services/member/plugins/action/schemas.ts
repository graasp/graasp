import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { entityIdSchemaRef } from '../../../../schemas/global';

// schema for removing all actions of a member
export const deleteAllById = {
  params: entityIdSchemaRef,
} as const satisfies FastifySchema;

export const getMemberFilteredActions = {
  querystring: Type.Object(
    {
      startDate: Type.Optional(Type.String({ format: 'date-time' })),
      endDate: Type.Optional(Type.String({ format: 'date-time' })),
    },
    {
      additionalProperties: false,
    },
  ),
} as const satisfies FastifySchema;
