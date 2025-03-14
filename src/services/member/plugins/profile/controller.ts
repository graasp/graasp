import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { asDefined } from '../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../strategies/validatedMemberAccountRole.js';
import { MemberProfileNotFound } from './errors.js';
import {
  createOwnProfile,
  getOwnProfile,
  getProfileForMember,
  updateOwnProfile,
} from './schemas.js';
import { MemberProfileService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const memberProfileService = resolveDependency(MemberProfileService);

  fastify.get('/own', { schema: getOwnProfile, preHandler: isAuthenticated }, async ({ user }) => {
    const member = asDefined(user?.account);
    assertIsMember(member);
    const profile = await memberProfileService.getOwn(member);
    if (!profile) {
      return null;
    }
    return profile;
  });

  fastify.get(
    '/:memberId',
    { schema: getProfileForMember, preHandler: optionalIsAuthenticated },
    async ({ params: { memberId } }) => {
      const profile = await memberProfileService.get(memberId);
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
      const memberProfile = await memberProfileService.post(member, data);

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
    async ({ user, body }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const profile = await memberProfileService.patch(member, body);
      if (!profile) {
        throw new MemberProfileNotFound();
      }
      return profile;
    },
  );
};

export default plugin;
