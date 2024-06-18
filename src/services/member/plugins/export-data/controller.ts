import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated } from '../../../auth/plugins/passport/index.js';
import { exportMemberData } from './schemas/schemas.js';
import { ExportMemberDataService } from './service.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    files: { service: fileService },
    mailer,
    db,
  } = fastify;
  const exportMemberDataService = new ExportMemberDataService();

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
          fileService,
          mailer,
        });
      });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
