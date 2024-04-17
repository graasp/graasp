import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { DataMemberService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    files: { service: fileService },
    mailer,
    db,
  } = fastify;
  const dataMemberService = new DataMemberService();

  // download all related data to the given user
  fastify.post(
    '/',
    {
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member }, reply) => {
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        await dataMemberService.requestDataExport({
          actor: member,
          repositories,
          fileService,
          mailer,
        });

        // TODO: no need to web sockets ?
      });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
