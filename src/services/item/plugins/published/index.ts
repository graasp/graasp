import { FastifyPluginAsync } from 'fastify';

import { UUID } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import graaspSearchPlugin from './plugins/search';
import {
  getCollections,
  getCollectionsForMember,
  getInformations,
  getManyInformations,
  getRecentCollections,
  publishItem,
  unpublishItem,
} from './schemas';
import { ItemPublishedService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items, log, mailer } = fastify;
  const pIS = new ItemPublishedService(items.service, mailer, log);

  fastify.register(graaspSearchPlugin);

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
      schema: getInformations,
    },
    async ({ params, member }) => {
      return pIS.get(member, buildRepositories(), params.itemId);
    },
  );

  fastify.get<{ Querystring: { itemId: string[] } }>(
    '/collections/informations',
    {
      preHandler: fastify.fetchMemberInSession,
      schema: getManyInformations,
    },
    async ({ member, query: { itemId } }) => {
      return pIS.getMany(member, buildRepositories(), itemId);
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

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/recent',
    {
      preHandler: fastify.fetchMemberInSession,
      schema: getRecentCollections,
    },
    async ({ member, query: { limit } }) => {
      return pIS.getRecentItems(member, buildRepositories(), limit);
    },
  );
};
export default plugin;
