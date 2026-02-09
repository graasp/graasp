import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { create, deleteOne, getOwnBookmark } from './itemBookmark.schemas';
import { BookmarkService } from './itemBookmark.service';

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
      const bookmarks = await bookmarkService.getOwn(db, member);
      return bookmarks;
    },
  );

  fastify.post(
    '/bookmarks/:itemId',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await bookmarkService.post(tx, member, itemId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.delete(
    '/bookmarks/:itemId',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await bookmarkService.delete(tx, member, itemId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
