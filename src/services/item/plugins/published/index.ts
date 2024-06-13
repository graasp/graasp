import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import graaspSearchPlugin from './plugins/search';
import {
  getCollectionsForMember,
  getInformations,
  getManyInformations,
  getMostLikedItems,
  getRecentCollections,
  publishItem,
  unpublishItem,
} from './schemas';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    itemsPublished,
    items: { service: itemService },
  } = fastify;

  fastify.register(graaspSearchPlugin);

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
        if (!member) {
          throw new UnauthorizedMember(member);
        }

        const repositories = buildRepositories(manager);

        const item = await itemService.get(
          member,
          repositories,
          params.itemId,
          PermissionLevel.Admin,
        );
        return itemsPublished.service.post(member, repositories, item);
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
