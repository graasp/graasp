import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { notUndefined } from '../../../../utils/assertions.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport/index.js';
import graaspSearchPlugin from './plugins/search/index.js';
import {
  getCollectionsForMember,
  getInformations,
  getManyInformations,
  getMostLikedItems,
  getRecentCollections,
  publishItem,
  unpublishItem,
} from './schemas.js';

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
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { memberId } }) => {
      return itemsPublished.service.getItemsForMember(user?.member, buildRepositories(), memberId);
    },
  );

  fastify.get<{ Params: { itemId: string } }>(
    '/collections/:itemId/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getInformations,
    },
    async ({ params, user }) => {
      return itemsPublished.service.get(user?.member, buildRepositories(), params.itemId);
    },
  );

  fastify.get<{ Querystring: { itemId: string[] } }>(
    '/collections/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getManyInformations,
    },
    async ({ user, query: { itemId } }) => {
      return itemsPublished.service.getMany(user?.member, buildRepositories(), itemId);
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/liked',
    {
      preHandler: optionalIsAuthenticated,
      schema: getMostLikedItems,
    },
    async ({ user, query: { limit } }) => {
      return itemsPublished.service.getLikedItems(user?.member, buildRepositories(), limit);
    },
  );

  fastify.post<{ Params: { itemId: string } }>(
    '/collections/:itemId/publish',
    {
      preHandler: isAuthenticated,
      schema: publishItem,
    },
    async ({ params, user }) => {
      const member = notUndefined(user?.member);
      return db.transaction(async (manager) => {
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
      preHandler: isAuthenticated,
      schema: unpublishItem,
    },
    async ({ params, user }) => {
      return db.transaction(async (manager) => {
        return itemsPublished.service.delete(
          user?.member,
          buildRepositories(manager),
          params.itemId,
        );
      });
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/recent',
    {
      preHandler: optionalIsAuthenticated,
      schema: getRecentCollections,
    },
    async ({ user, query: { limit } }) => {
      return itemsPublished.service.getRecentItems(user?.member, buildRepositories(), limit);
    },
  );
};
export default plugin;
