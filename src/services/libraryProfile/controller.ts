import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../utils/repositories';
import { createProfile, getOwnProfile, getProfileForMember, updateMemberProfile } from './schemas';
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
  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    { schema: getProfileForMember },
    async ({ params: { memberId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.get(memberId, repositories);
      });
    },
  );
  fastify.get<{ Params: { memberId: string } }>(
    '/own',
    { schema: getOwnProfile, preHandler: fastify.verifyAuthentication },
    async ({ member }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.getOwn(member?.id, repositories);
      });
    },
  );
  fastify.patch<{ Body: Partial<IMemberProfile> }>(
    '/',
    { schema: updateMemberProfile, preHandler: fastify.verifyAuthentication },
    async ({ member, body }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.patch(body, repositories, member);
      });
    },
  );
};

export default plugin;
