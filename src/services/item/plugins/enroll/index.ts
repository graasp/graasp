import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { matchOne } from '../../../authorization';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { enroll } from './schema';
import { EnrollService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const enrollService = resolveDependency(EnrollService);

  fastify.post(
    '/:itemId/enroll',
    {
      schema: enroll,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { itemId } = params;

      return await db.transaction(async (tx) => {
        return await enrollService.enroll(tx, member, itemId);
      });
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-enroll',
});
