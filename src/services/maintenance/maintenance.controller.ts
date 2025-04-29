import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { getNextMaintenance } from './maintenance.schemas';
import { MaintenanceService } from './maintenance.service';

export const maintenancePlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const maintenanceService = resolveDependency(MaintenanceService);

  fastify.get(
    '/maintenance/next',
    {
      schema: getNextMaintenance,
    },
    async (_request, reply) => {
      const entry = await maintenanceService.getNext(db);
      if (!entry) {
        return reply.status(StatusCodes.NO_CONTENT).send();
      }
      return entry;
    },
  );
};
