import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils.js';
import { db } from '../../../../../drizzle/db.js';
import { asDefined } from '../../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../../authentication.js';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole.js';
import { ItemService } from '../../../service.js';
import { PublicationService } from '../publicationState/publication.service.js';
import { ItemPublishedService } from './itemPublished.service.js';
import graaspSearchPlugin from './plugins/search/index.js';
import { getCollectionsForMember, getInformations, publishItem, unpublishItem } from './schemas.js';

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
