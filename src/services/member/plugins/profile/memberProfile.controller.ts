import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../strategies/validatedMemberAccountRole';
import {
  createOwnProfile,
  getOwnProfile,
  getProfileForMember,
  updateOwnProfile,
} from './memberProfile.schemas';
import { MemberProfileService } from './memberProfile.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const memberProfileService = resolveDependency(MemberProfileService);

  fastify.get('/own', { schema: getOwnProfile, preHandler: isAuthenticated }, async ({ user }) => {
    const member = asDefined(user?.account);
    assertIsMember(member);
    const profile = await memberProfileService.getOwn(db, member);
    if (!profile) {
      return null;
    }
    return profile;
  });

  fastify.get(
    '/:memberId',
    { schema: getProfileForMember, preHandler: optionalIsAuthenticated },
    async ({ params: { memberId } }) => {
      const profile = await memberProfileService.get(db, memberId);
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
      const memberProfile = await memberProfileService.post(db, member, data);

      // reply with a "CREATED" status
      reply.status(StatusCodes.CREATED);
      return memberProfile;
    },
  );

  fastify.patch(
    '/',
    {
      schema: updateOwnProfile,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);

      await memberProfileService.patch(db, member, body);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
