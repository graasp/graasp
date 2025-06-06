import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';

const maintenanceSchema = customType.StrictObject(
  {
    slug: Type.String(),
    startAt: customType.DateTime(),
    endAt: customType.DateTime(),
  },
  { description: 'Entry of a maintenance period, usually to perform a migration.' },
);

export const getNextMaintenance = {
  operationId: 'getNextMaintenance',
  tags: ['maintenance'],
  summary: 'get next maintenance period',
  description: 'Return next maintenance period, usually to perform a migration',

  response: {
    [StatusCodes.OK]: customType.Nullable(maintenanceSchema),

    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
