import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../entities/member';
import { validatedMemberAccountRole } from '../../strategies/validatedMemberAccountRole';
import { MemberProfileNotFound } from './errors';
import { createOwnProfile, getOwnProfile, getProfileForMember, updateOwnProfile } from './schemas';
import { MemberProfileService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const memberProfileService = new MemberProfileService();

  fastify.get('/own', { schema: getOwnProfile, preHandler: isAuthenticated }, async ({ user }) => {
    const member = asDefined(user?.account);
    assertIsMember(member);
    const profile = await memberProfileService.getOwn(member, buildRepositories());
    if (!profile) {
      return null;
    }
    return profile;
  });

  fastify.get(
    '/:memberId',
    { schema: getProfileForMember, preHandler: optionalIsAuthenticated },
    async ({ params: { memberId } }) => {
      const profile = await memberProfileService.get(buildRepositories(), memberId);
      if (!profile) {
        return null;
      }
      return profile;
    },
  );

  fastify.post(
    '/',
    {
      schema: createOwnProfile,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const { user, body: data } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const memberProfile = await memberProfileService.post(member, repositories, data);
        reply.status(StatusCodes.CREATED);

        return memberProfile;
      });
    },
  );

  fastify.patch(
    '/',
    {
      schema: updateOwnProfile,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
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
