import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import { isAuthenticated, optionalIsAuthenticated } from '../../../../auth/plugins/passport';
import { assertIsMember } from '../../../../authentication';
import { matchOne } from '../../../../authorization';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../service';
import { PublicationService } from '../publicationState/publication.service';
import { ItemPublishedService } from './itemPublished.service';
import graaspSearchPlugin from './plugins/search';
import { getCollectionsForMember, getInformations, publishItem, unpublishItem } from './schemas';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemPublishedService = resolveDependency(ItemPublishedService);
  const publicationService = resolveDependency(PublicationService);
  const itemService = resolveDependency(ItemService);

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
    async ({ params, user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        const item = await itemService.basicItemService.get(
          tx,
          member,
          params.itemId,
          PermissionLevel.Admin,
        );

        const status = await publicationService.computeStateForItem(tx, member, item.id);

        await itemPublishedService.post(tx, member, item, status);
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
      await db.transaction(async (tx) => {
        await itemPublishedService.delete(tx, member, params.itemId);
      });
    },
  );
};
export default plugin;
