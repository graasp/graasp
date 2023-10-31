import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../utils/repositories';
import { createProfile } from './schemas';
import { MemberProfileService } from './service';

export interface IMemberProfile {
  bio: string;
  visibility?: boolean;
  facebookLink?: string;
  linkedinLink?: string;
  twitterLink?: string;
}
const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, log } = fastify;

  const memberProfileService = new MemberProfileService(log);

  fastify.post<{ Body: IMemberProfile }>(
    '/',
    {
      schema: createProfile,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const { member, body: data } = request;
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const memberProfile = await memberProfileService.post(data, repositories, member);
        reply.status(StatusCodes.CREATED);

        return memberProfile;
      });
    },
  );
};

export default plugin;
