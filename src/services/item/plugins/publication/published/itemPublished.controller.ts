import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../../auth/plugins/passport';
import { assertIsMember } from '../../../../authentication';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { PublicationService } from '../publicationState/publication.service';
import {
  getCollectionsForMember,
  getInformations,
  publishItem,
  unpublishItem,
} from './itemPublished.schemas';
import { ItemPublishedService } from './itemPublished.service';
import graaspSearchPlugin from './plugins/search/search.controller';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemPublishedService = resolveDependency(ItemPublishedService);
  const publicationService = resolveDependency(PublicationService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  fastify.register(graaspSearchPlugin);

  fastify.get(
    '/collections/members/:memberId',
    {
      schema: getCollectionsForMember,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { memberId } }) => {
      return itemPublishedService.getItemsForMember(db, user?.account, memberId);
    },
  );

  fastify.get(
    '/collections/:itemId/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getInformations,
    },
    async ({ params, user }) => {
      return itemPublishedService.get(db, user?.account, params.itemId);
    },
  );

  fastify.post(
    '/collections/:itemId/publish',
    {
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      schema: publishItem,
    },
    async ({ params, user }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        const item = await authorizedItemService.getItemById(tx, {
          accountId: member.id,
          itemId: params.itemId,
          permission: 'admin',
        });

        const status = await publicationService.computeStateForItem(tx, member, item.id);

        await itemPublishedService.post(tx, member, item, status);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.delete(
    '/collections/:itemId/unpublish',
    {
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      schema: unpublishItem,
    },
    async ({ params, user }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await itemPublishedService.delete(tx, member, params.itemId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};
export default plugin;
