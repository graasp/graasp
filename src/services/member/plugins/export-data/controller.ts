import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { exportMemberData } from './schemas/schemas';
import { ExportMemberDataService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const exportMemberDataService = resolveDependency(ExportMemberDataService);

  // download all related data to the given user
  fastify.post(
    '/',
    {
      schema: exportMemberData,
      preHandler: isAuthenticated,
    },
    async ({ user }, reply) => {
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        await exportMemberDataService.requestDataExport({
          actor: user?.member,
          repositories,
        });
      });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
