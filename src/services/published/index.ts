import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../util/repositories';
import { getCollections, publishItem, unpublishItem } from './schemas';
import { ItemPublishedService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const pIS = new ItemPublishedService();

  fastify.get<{ Querystring: { categoryId: string[] } }>(
    '/collections',
    {
      schema: getCollections,
    },
    async ({ query, member }) => {
      return pIS.getItemsByCategories(member, buildRepositories(), query.categoryId);
    },
  );

  fastify.get<{ Querystring: { category: string[] } }>(
    '/collections/own',
    {
      preHandler: fastify.verifyAuthentication,
    },
    async ({ query, member }) => {
      return pIS.getOwnItems(member, buildRepositories());
    },
  );

  fastify.get<{ Params: { itemId: string } }>(
    '/collections/:itemId/informations',
    {
      preHandler: fastify.fetchMemberInSession,
      // schema,
    },
    async ({ params, member }) => {
      return pIS.get(member, buildRepositories(), params.itemId);
    },
  );

  fastify.post<{ Params: { itemId: string } }>(
    '/collections/:itemId/publish',
    {
      preHandler: fastify.verifyAuthentication,
      schema: publishItem,
    },
    async ({ params, member }) => {
      return db.transaction(async (manager) => {
        return pIS.post(member, buildRepositories(manager), params.itemId);
      });
    },
  );

  fastify.delete<{ Params: { itemId: string } }>(
    '/collections/:itemId/unpublish',
    {
      preHandler: fastify.verifyAuthentication,
      schema: unpublishItem,
    },
    async ({ params, member }) => {
      return db.transaction(async (manager) => {
        return pIS.delete(member, buildRepositories(manager), params.itemId);
      });
    },
  );
};
export default plugin;
