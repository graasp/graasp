import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
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
      preHandler: authenticated,
    },
    async (request, reply) => {
      const { user, body: data } = request;
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const memberProfile = await memberProfileService.post(user!.member, repositories, data);
        reply.status(StatusCodes.CREATED);

        return memberProfile;
      });
    },
  );

  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    { schema: getProfileForMember, preHandler: optionalAuthenticated },
    async ({ params: { memberId } }) => {
      return memberProfileService.get(memberId, buildRepositories());
    },
  );

  fastify.get<{ Params: { memberId: string } }>(
    '/own',
    { schema: getOwnProfile, preHandler: authenticated },
    async ({ user }) => {
      return memberProfileService.getOwn(user!.member, buildRepositories());
    },
  );

  fastify.patch<{ Body: Partial<IMemberProfile> }>(
    '/',
    { schema: updateMemberProfile, preHandler: authenticated },
    async ({ user, body }) => {
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return memberProfileService.patch(user!.member, repositories, body);
      });
    },
  );
};

export default plugin;
