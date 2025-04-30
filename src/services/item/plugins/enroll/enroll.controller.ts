import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { enroll } from './enroll.schema';
import { EnrollService } from './enroll.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const enrollService = resolveDependency(EnrollService);

  fastify.post(
    '/:itemId/enroll',
    {
      schema: enroll,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { itemId } = params;

      await db.transaction(async (tx) => {
        await enrollService.enroll(tx, member, itemId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin, {
  fastify: '5.x',
  name: 'graasp-plugin-enroll',
});
