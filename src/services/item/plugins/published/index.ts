import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { UUID } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import graaspSearchPlugin from './plugins/search';
import {
  getCollections,
  getCollectionsForMember,
  getInformations,
  getManyInformations,
  getMostLikedItems,
  getRecentCollections,
  publishItem,
  unpublishItem,
} from './schemas';
import { ItemPublishedService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, itemsPublished } = fastify;

  fastify.register(graaspSearchPlugin);

  fastify.get<{ Querystring: { categoryId: string[] } }>(
    '/collections',
    {
      schema: getCollections,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ query, member }) => {
      return itemsPublished.service.getItemsByCategories(
        member,
        buildRepositories(),
        query.categoryId,
      );
    },
  );

  fastify.get<{ Params: { memberId: UUID } }>(
    '/collections/members/:memberId',
    {
      schema: getCollectionsForMember,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { memberId } }) => {
      return itemsPublished.service.getItemsForMember(member, buildRepositories(), memberId);
    },
  );

  fastify.get<{ Params: { itemId: string } }>(
    '/collections/:itemId/informations',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getInformations,
    },
    async ({ params, member }) => {
      return itemsPublished.service.get(member, buildRepositories(), params.itemId);
    },
  );

  fastify.get<{ Querystring: { itemId: string[] } }>(
    '/collections/informations',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getManyInformations,
    },
    async ({ member, query: { itemId } }) => {
      return itemsPublished.service.getMany(member, buildRepositories(), itemId);
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/liked',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getMostLikedItems,
    },
    async ({ member, query: { limit } }) => {
      return itemsPublished.service.getLikedItems(member, buildRepositories(), limit);
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
        return itemsPublished.service.post(member, buildRepositories(manager), params.itemId);
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
        return itemsPublished.service.delete(member, buildRepositories(manager), params.itemId);
      });
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/recent',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getRecentCollections,
    },
    async ({ member, query: { limit } }) => {
      return itemsPublished.service.getRecentItems(member, buildRepositories(), limit);
    },
  );
};
export default plugin;
