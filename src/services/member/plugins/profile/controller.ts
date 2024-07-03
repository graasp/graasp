import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { MemberProfile } from './entities/profile';
import { MemberProfileNotFound } from './errors';
import { createProfile, getOwnProfile, getProfileForMember, updateMemberProfile } from './schemas';
import { MemberProfileService } from './service';
import { IMemberProfile } from './types';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, log } = fastify;

  const memberProfileService = new MemberProfileService(log);

  fastify.get<{ Params: { memberId: string } }>(
    '/own',
    { schema: getOwnProfile, preHandler: isAuthenticated },
    async ({ user }, reply) => {
      const member = notUndefined(user?.member);
      const profile = await memberProfileService.getOwn(member, buildRepositories());
      if (!profile) {
        reply.status(StatusCodes.NO_CONTENT);
        return;
      }
      return profile;
    },
  );

  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    { schema: getProfileForMember, preHandler: optionalIsAuthenticated },
    async ({ user, params: { memberId } }, reply) => {
      const profile = await memberProfileService.get(user?.member, buildRepositories(), memberId);
      console.log(profile);
      if (!profile) {
        reply.status(StatusCodes.NO_CONTENT);
        return;
      }
      return profile;
    },
  );

  fastify.post<{ Body: IMemberProfile }>(
    '/',
    {
      schema: createProfile,
      preHandler: isAuthenticated,
    },
    async (request, reply) => {
      const { user, body: data } = request;
      const member = notUndefined(user?.member);
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const memberProfile = await memberProfileService.post(member, repositories, data);
        reply.status(StatusCodes.CREATED);

        return memberProfile;
      });
    },
  );

  fastify.patch<{ Body: Partial<IMemberProfile> }>(
    '/',
    { schema: updateMemberProfile, preHandler: isAuthenticated },
    async ({ user, body }): Promise<MemberProfile> => {
      return db.transaction(async (manager) => {
        const member = notUndefined(user?.member);
        const profile = await memberProfileService.patch(member, buildRepositories(manager), body);
        if (!profile) {
          throw new MemberProfileNotFound();
        }
        return profile;
      });
    },
  );
};

export default plugin;
