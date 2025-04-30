import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';

const maintenanceSchemaRef = registerSchemaAsRef(
  'maintenance',
  'Maintenance Entry',
  customType.StrictObject(
    {
      slug: Type.String(),
      startAt: customType.DateTime(),
      endAt: customType.DateTime(),
    },
    { description: 'Entry of a maintenance period, usually to perform a migration.' },
  ),
);

export const getNextMaintenance = {
  operationId: 'getNextMaintenance',
  tags: ['maintenance'],
  summary: 'get next maintenance period',
  description: 'Return next maintenance period, usually to perform a migration',

  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.OK]: maintenanceSchemaRef,

    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
