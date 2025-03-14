import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { BookmarkService } from './itemBookmark.service.js';
import { create, deleteOne, getOwnBookmark } from './schemas.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const bookmarkService = resolveDependency(BookmarkService);

  fastify.get(
    '/favorite',
    { schema: getOwnBookmark, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return bookmarkService.getOwn(db, member);
    },
  );

  fastify.post(
    '/favorite/:itemId',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await bookmarkService.post(tx, member, itemId);
      });
    },
  );

  fastify.delete(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await bookmarkService.delete(tx, member, itemId);
      });
    },
  );
};

export default plugin;
