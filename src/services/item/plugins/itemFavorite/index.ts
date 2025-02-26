import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { FavoriteService } from './itemBookmark.service';
import { create, deleteOne, getOwnFavorite } from './schemas';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const favoriteService = resolveDependency(FavoriteService);

  // get favorites
  fastify.get(
    '/favorite',
    { schema: getOwnFavorite, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return favoriteService.getOwn(db, member);
    },
  );

  // insert favorite
  fastify.post(
    '/favorite/:itemId',
    { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (tx) => {
        return favoriteService.post(tx, member, itemId);
      });
    },
  );

  // delete favorite
  fastify.delete(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (tx) => {
        return favoriteService.delete(tx, member, itemId);
      });
    },
  );
};

export default plugin;
