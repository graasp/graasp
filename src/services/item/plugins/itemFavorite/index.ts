import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../dependencies';
import { buildRepositories } from '../../../../utils/repositories';
import { ItemService } from '../../service';
import common, { create, deleteOne, getFavorite } from './schemas';
import { FavoriteService } from './services/favorite';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemService = resolveDependency(ItemService);
  const favoriteService = new FavoriteService(itemService);

  // schemas
  fastify.addSchema(common);

  // get favorites
  fastify.get(
    '/favorite',
    { schema: getFavorite, preHandler: fastify.verifyAuthentication },
    async ({ member }) => {
      return favoriteService.getOwn(member, buildRepositories());
    },
  );

  // insert favorite
  fastify.post<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: create, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.post(member, buildRepositories(manager), itemId);
      });
    },
  );

  // delete favorite
  fastify.delete<{ Params: { itemId: string } }>(
    '/favorite/:itemId',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { itemId } }) => {
      return db.transaction(async (manager) => {
        return favoriteService.delete(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
