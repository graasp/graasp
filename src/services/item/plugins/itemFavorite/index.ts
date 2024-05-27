import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated } from '../../../auth/plugins/passport';
import common, { create, deleteOne, getFavorite } from './schemas';
import { FavoriteService } from './services/favorite';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;
  const favoriteService = new FavoriteService(items.service);

  // schemas
  fastify.addSchema(common);

  // get favorites
  fastify.get('/favorite', { schema: getFavorite, preHandler: authenticated }, async ({ user }) => {
    return favoriteService.getOwn(user!.member!, buildRepositories());
  });

  // insert favorite
  fastify.post<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: create, preHandler: authenticated },
    async ({ user, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.post(user!.member!, buildRepositories(manager), itemId);
      });
    },
  );

  // delete favorite
  fastify.delete<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: authenticated },
    async ({ user, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.delete(user!.member!, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
