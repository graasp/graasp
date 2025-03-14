import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox.js';

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
} as const satisfies FastifySchema;
