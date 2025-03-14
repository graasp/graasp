import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { enroll } from './schema.js';
import { EnrollService } from './service.js';

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

      await db.transaction(async (tx) => {
        await enrollService.enroll(tx, member, itemId);
      });
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-enroll',
});
