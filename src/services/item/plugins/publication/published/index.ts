import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import { isAuthenticated, optionalIsAuthenticated } from '../../../../auth/plugins/passport';
import { matchOne } from '../../../../authorization';
import { assertIsMember } from '../../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../service';
import { PublicationService } from '../publicationState/service';
import graaspSearchPlugin from './plugins/search';
import {
  getCollectionsForMember,
  getInformations,
  getManyInformations,
  publishItem,
  unpublishItem,
} from './schemas';
import { ItemPublishedService } from './service';

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

  fastify.get(
    '/collections/informations',
    {
      preHandler: optionalIsAuthenticated,
      schema: getManyInformations,
    },
    async ({ user, query: { itemId } }) => {
      return itemPublishedService.getMany(db, user?.account, itemId);
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
      return db.transaction(async (tx) => {
        const item = await itemService.get(tx, member, params.itemId, PermissionLevel.Admin);

        const status = await publicationService.computeStateForItem(tx, member, item.id);

        return itemPublishedService.post(tx, member, item, status);
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
      return db.transaction(async (tx) => {
        return itemPublishedService.delete(tx, member, params.itemId);
      });
    },
  );
};
export default plugin;
