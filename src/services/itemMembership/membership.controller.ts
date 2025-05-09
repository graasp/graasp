import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../auth/plugins/passport';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { create, deleteOne, getItemMembershipsForItem, updateOne } from './membership.schemas';
import { ItemMembershipService } from './membership.service';
import MembershipRequestAPI from './plugins/MembershipRequest/membershipRequest.controller';
import { membershipWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemMembershipService = resolveDependency(ItemMembershipService);

  fastify.register(MembershipRequestAPI, {
    prefix: '/:itemId/memberships/requests',
  });

  // routes
  fastify.register(
    async function (fastify: FastifyInstanceTypebox) {
      fastify.register(membershipWsHooks);

      // get many item's memberships
      // returns empty for item not found
      fastify.get(
        '/',
        { schema: getItemMembershipsForItem, preHandler: optionalIsAuthenticated },
        async ({ user, query: { itemId } }) => {
          return itemMembershipService.getForItem(db, user?.account, itemId);
        },
      );

      // create item membership
      fastify.post(
        '/',
        {
          schema: create,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, query: { itemId }, body }, reply) => {
          const account = asDefined(user?.account);
          await db.transaction(async (tx) => {
            await itemMembershipService.create(tx, account, {
              permission: body.permission,
              itemId,
              memberId: body.accountId,
            });
          });
          reply.status(StatusCodes.NO_CONTENT);
        },
      );

      // update item membership
      fastify.patch(
        '/:id',
        {
          schema: updateOne,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, params: { id }, body }, reply) => {
          const account = asDefined(user?.account);
          await db.transaction(async (tx) => {
            await itemMembershipService.patch(tx, account, id, body);
          });
          reply.status(StatusCodes.NO_CONTENT);
        },
      );

      // delete item membership
      fastify.delete(
        '/:id',
        { schema: deleteOne, preHandler: isAuthenticated },
        async ({ user, params: { id }, query: { purgeBelow } }, reply) => {
          const account = asDefined(user?.account);
          await db.transaction(async (tx) => {
            await itemMembershipService.deleteOne(tx, account, id, {
              purgeBelow,
            });
          });
          reply.status(StatusCodes.NO_CONTENT);
        },
      );
    },
    { prefix: '/:itemId/memberships' },
  );
};

export default plugin;
