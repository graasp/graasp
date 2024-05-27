import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
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
      preHandler: optionalAuthenticated,
    },
    async ({ user, params: { memberId } }) => {
      return itemsPublished.service.getItemsForMember(user?.member, buildRepositories(), memberId);
    },
  );

  fastify.get<{ Params: { itemId: string } }>(
    '/collections/:itemId/informations',
    {
      preHandler: optionalAuthenticated,
      schema: getInformations,
    },
    async ({ params, user }) => {
      return itemsPublished.service.get(user?.member, buildRepositories(), params.itemId);
    },
  );

  fastify.get<{ Querystring: { itemId: string[] } }>(
    '/collections/informations',
    {
      preHandler: optionalAuthenticated,
      schema: getManyInformations,
    },
    async ({ user, query: { itemId } }) => {
      return itemsPublished.service.getMany(user?.member, buildRepositories(), itemId);
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/liked',
    {
      preHandler: optionalAuthenticated,
      schema: getMostLikedItems,
    },
    async ({ user, query: { limit } }) => {
      return itemsPublished.service.getLikedItems(user?.member, buildRepositories(), limit);
    },
  );

  fastify.post<{ Params: { itemId: string } }>(
    '/collections/:itemId/publish',
    {
      preHandler: authenticated,
      schema: publishItem,
    },
    async ({ params, user }) => {
      return db.transaction(async (manager) => {
        return itemsPublished.service.post(user!.member, buildRepositories(manager), params.itemId);
      });
    },
  );

  fastify.delete<{ Params: { itemId: string } }>(
    '/collections/:itemId/unpublish',
    {
      preHandler: authenticated,
      schema: unpublishItem,
    },
    async ({ params, user }) => {
      return db.transaction(async (manager) => {
        return itemsPublished.service.delete(
          user!.member,
          buildRepositories(manager),
          params.itemId,
        );
      });
    },
  );

  fastify.get<{ Querystring: { limit?: number } }>(
    '/collections/recent',
    {
      preHandler: optionalAuthenticated,
      schema: getRecentCollections,
    },
    async ({ user, query: { limit } }) => {
      return itemsPublished.service.getRecentItems(user?.member, buildRepositories(), limit);
    },
  );
};
export default plugin;
