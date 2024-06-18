import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated } from '../../../auth/plugins/passport/index.js';
import common, { create, deleteOne, getFavorite } from './schemas.js';
import { FavoriteService } from './services/favorite.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;
  const favoriteService = new FavoriteService(items.service);

  // schemas
  fastify.addSchema(common);

  // get favorites
  fastify.get(
    '/favorite',
    { schema: getFavorite, preHandler: isAuthenticated },
    async ({ user }) => {
      return favoriteService.getOwn(user?.member, buildRepositories());
    },
  );

  // insert favorite
  fastify.post<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: create, preHandler: isAuthenticated },
    async ({ user, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.post(user?.member, buildRepositories(manager), itemId);
      });
    },
  );

  // delete favorite
  fastify.delete<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: isAuthenticated },
    async ({ user, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.delete(user?.member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
