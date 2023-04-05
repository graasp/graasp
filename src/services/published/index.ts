import { FastifyPluginAsync } from 'fastify';

import { UUID } from '@graasp/sdk';

import { buildRepositories } from '../../util/repositories';
import { getCollections, getCollectionsForMember, publishItem, unpublishItem } from './schemas';
import { ItemPublishedService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;
  const pIS = new ItemPublishedService(items.service);

  fastify.get<{ Querystring: { categoryId: string[] } }>(
    '/collections',
    {
      schema: getCollections,
      preHandler: fastify.fetchMemberInSession,
    },
    async ({ query, member }) => {
      return pIS.getItemsByCategories(member, buildRepositories(), query.categoryId);
    },
  );

  fastify.get<{ Params: { memberId: UUID } }>(
    '/collections/members/:memberId',
    {
      schema: getCollectionsForMember,
      preHandler: fastify.fetchMemberInSession,
    },
    async ({ member, params: { memberId } }) => {
      return pIS.getItemsForMember(member, buildRepositories(), memberId);
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
