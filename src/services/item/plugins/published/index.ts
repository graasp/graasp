import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { resolveDependency } from '../../../../dependencies';
import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { ItemService } from '../../service';
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
import { ItemPublishedService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemPublishedService = resolveDependency(ItemPublishedService);
  const itemService = resolveDependency(ItemService);

  fastify.register(graaspSearchPlugin);

  fastify.get<{ Params: { memberId: UUID } }>(
    '/collections/members/:memberId',
    {
      schema: getCollectionsForMember,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { memberId } }) => {
      return itemPublishedService.getItemsForMember(member, buildRepositories(), memberId);
    },
  );

  fastify.get<{ Params: { itemId: string } }>(
    '/collections/:itemId/informations',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getInformations,
    },
    async ({ params, member }) => {
      return itemPublishedService.get(member, buildRepositories(), params.itemId);
    },
  );

  fastify.get<{ Querystring: { itemId: string[] } }>(
    '/collections/informations',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getManyInformations,
    },
    async ({ member, query: { itemId } }) => {
      return itemPublishedService.getMany(member, buildRepositories(), itemId);
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/liked',
    {
      preHandler: fastify.attemptVerifyAuthentication,
      schema: getMostLikedItems,
    },
    async ({ member, query: { limit } }) => {
      return itemPublishedService.getLikedItems(member, buildRepositories(), limit);
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
        return itemPublishedService.post(member, repositories, item);
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
        return itemPublishedService.delete(member, buildRepositories(manager), params.itemId);
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
      return itemPublishedService.getRecentItems(member, buildRepositories(), limit);
    },
  );
};
export default plugin;
