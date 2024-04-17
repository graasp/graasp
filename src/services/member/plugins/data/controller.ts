import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { DataMemberService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    files: { service: fileService },
    mailer,
  } = fastify;
  const dataMemberService = new DataMemberService(fileService, mailer);

  // download all related data to the given user
  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    {
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member }) => {
      const repositories = buildRepositories();

      return dataMemberService.requestExport(member, repositories);
    },
  );
};

export default plugin;
