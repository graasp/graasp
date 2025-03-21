import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { BookmarkService } from './itemBookmark.service';
import { create, deleteOne, getOwnBookmark } from './schemas';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const bookmarkService = resolveDependency(BookmarkService);

  fastify.get(
    '/bookmarks',
    {
      schema: getOwnBookmark,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await bookmarkService.getOwn(db, member);
    },
  );

  fastify.post(
    '/bookmarks/:itemId',
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
    '/bookmarks/:itemId',
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
