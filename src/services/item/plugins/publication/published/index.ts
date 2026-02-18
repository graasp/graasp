import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../../auth/plugins/passport';
import { matchOne } from '../../../../authorization';
import { assertIsMember } from '../../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../service';
import { PublicationService } from '../publicationState/service';
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

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
  const itemPublishedService = resolveDependency(ItemPublishedService);
  const publicationService = resolveDependency(PublicationService);
  const itemService = resolveDependency(ItemService);

  fastify.get(
    '/collections/members/:memberId',
    {
      schema: getCollectionsForMember,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { memberId } }) => {
      return itemPublishedService.getItemsForMember(user?.account, buildRepositories(), memberId);
    },
  );

  fastify.get(
    '/collections/:itemId/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getInformations,
    },
    async ({ params, user }) => {
      return itemPublishedService.get(user?.account, buildRepositories(), params.itemId);
    },
  );

  fastify.get(
    '/collections/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getManyInformations,
    },
    async ({ user, query: { itemId } }) => {
      return itemPublishedService.getMany(user?.account, buildRepositories(), itemId);
    },
  );

  fastify.get(
    '/collections/liked',
    {
      preHandler: optionalIsAuthenticated,
      schema: getMostLikedItems,
    },
    async ({ user, query: { limit } }) => {
      return itemPublishedService.getLikedItems(user?.account, buildRepositories(), limit);
    },
  );

  fastify.post(
    '/collections/:itemId/publish',
    {
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      schema: publishItem,
    },
    async ({ params, user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.get(
          member,
          repositories,
          params.itemId,
          PermissionLevel.Admin,
        );

        const status = await publicationService.computeStateForItem(member, repositories, item.id);

        return itemPublishedService.post(member, repositories, item, status);
      });
    },
  );

  fastify.delete(
    '/collections/:itemId/unpublish',
    {
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      schema: unpublishItem,
    },
    async ({ params, user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        return itemPublishedService.delete(member, buildRepositories(manager), params.itemId);
      });
    },
  );

  fastify.get(
    '/collections/recent',
    {
      preHandler: optionalIsAuthenticated,
      schema: getRecentCollections,
    },
    async ({ user, query: { limit } }) => {
      return itemPublishedService.getRecentItems(user?.account, buildRepositories(), limit);
    },
  );
};
export default plugin;
