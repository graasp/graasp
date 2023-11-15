import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../utils/repositories';
import { createProfile, getOwnProfile, getProfileForMember, updateMemberProfile } from './schemas';
import { MemberProfileService } from './service';
import { IMemberProfile } from './types';

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
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const memberProfile = await memberProfileService.post(member, repositories, data);
        reply.status(StatusCodes.CREATED);

        return memberProfile;
      });
    },
  );
  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    { schema: getProfileForMember, preHandler: fastify.attemptVerifyAuthentication },
    async ({ params: { memberId } }) => {
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.get(memberId, repositories);
      });
    },
  );
  fastify.get<{ Params: { memberId: string } }>(
    '/own',
    { schema: getOwnProfile, preHandler: fastify.verifyAuthentication },
    async ({ member }) => {
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.getOwn(member, repositories);
      });
    },
  );
  fastify.patch<{ Body: Partial<IMemberProfile> }>(
    '/',
    { schema: updateMemberProfile, preHandler: fastify.verifyAuthentication },
    async ({ member, body }) => {
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.patch(member, repositories, body);
      });
    },
  );
};

export default plugin;
