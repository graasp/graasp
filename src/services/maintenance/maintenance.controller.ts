import { StatusCodes } from 'http-status-codes';

import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { getNextMaintenance } from './maintenance.schemas';
import { MaintenanceService } from './maintenance.service';

export const maintenancePlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const maintenanceService = resolveDependency(MaintenanceService);
  fastify.register(
    async (fastify) => {
      // add CORS support
      if (fastify.corsPluginOptions) {
        await fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.get(
        '/next',
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
    },
    { prefix: 'maintenance' },
  );
};
