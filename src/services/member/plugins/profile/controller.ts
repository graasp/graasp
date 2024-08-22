import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../entities/member';
import { validatedMemberAccountRole } from '../../strategies/validatedMemberAccountRole';
import { MemberProfile } from './entities/profile';
import { MemberProfileNotFound } from './errors';
import { createProfile, getOwnProfile, getProfileForMember, updateMemberProfile } from './schemas';
import { MemberProfileService } from './service';
import { IMemberProfile } from './types';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const memberProfileService = new MemberProfileService();

  fastify.get<{ Params: { memberId: string } }>(
    '/own',
    { schema: getOwnProfile, preHandler: isAuthenticated },
    async ({ user }, reply) => {
      const member = notUndefined(user?.account);
      assertIsMember(member);
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
    async ({ params: { memberId } }, reply) => {
      const profile = await memberProfileService.get(buildRepositories(), memberId);
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
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const { user, body: data } = request;
      const member = notUndefined(user?.account);
      assertIsMember(member);
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
    {
      schema: updateMemberProfile,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body }): Promise<MemberProfile> => {
      return db.transaction(async (manager) => {
        const member = notUndefined(user?.account);
        assertIsMember(member);
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
