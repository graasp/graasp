import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import common, { create, deleteOne, getFavorite } from './schemas';
import { FavoriteService } from './services/favorite';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const favoriteService = resolveDependency(FavoriteService);

  // schemas
  fastify.addSchema(common);

  // get favorites
  fastify.get(
    '/favorite',
    { schema: getFavorite, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = notUndefined(user?.member);
      return favoriteService.getOwn(member, buildRepositories());
    },
  );

  // insert favorite
  fastify.post<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: create, preHandler: isAuthenticated },
    async ({ user, params: { itemId } }) => {
      const member = notUndefined(user?.member);
      return db.transaction(async (manager) => {
        return favoriteService.post(member, buildRepositories(manager), itemId);
      });
    },
  );

  // delete favorite
  fastify.delete<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: isAuthenticated },
    async ({ user, params: { itemId } }) => {
      const member = notUndefined(user?.member);
      return db.transaction(async (manager) => {
        return favoriteService.delete(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
