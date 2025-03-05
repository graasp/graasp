import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import MembershipRequestAPI from './plugins/MembershipRequest';
import { create, createMany, deleteOne, getManyItemMemberships, updateOne } from './schemas';
import { ItemMembershipService } from './service';
import { membershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemMembershipService = resolveDependency(ItemMembershipService);

  fastify.register(MembershipRequestAPI, {
    prefix: '/items/:itemId/memberships/requests',
  });

  // routes
  fastify.register(
    async function (fastify: FastifyInstanceTypebox) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.register(membershipWsHooks);

      // get many item's memberships
      // returns empty for item not found
      fastify.get(
        '/',
        { schema: getManyItemMemberships, preHandler: optionalIsAuthenticated },
        async ({ user, query: { itemId: ids } }) => {
          return itemMembershipService.getForManyItems(db, user?.account, ids);
        },
      );

      // create item membership
      fastify.post(
        '/',
        {
          schema: create,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, query: { itemId }, body }) => {
          const account = asDefined(user?.account);
          return db.transaction((tx) => {
            return itemMembershipService.create(tx, account, {
              permission: body.permission,
              itemId,
              memberId: body.accountId,
            });
          });
        },
      );

      // create many item memberships
      fastify.post(
        '/:itemId',
        {
          schema: createMany,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, params: { itemId }, body }) => {
          const account = asDefined(user?.account);
          // BUG: because we use this call to save csv member
          // we have to return immediately
          // solution: it's probably simpler to upload a csv and handle it in the back
          return db.transaction((tx) => {
            return itemMembershipService.createMany(tx, account, body.memberships, itemId);
          });
        },
      );

      // update item membership
      fastify.patch(
        '/:id',
        {
          schema: updateOne,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, params: { id }, body }) => {
          const account = asDefined(user?.account);
          return db.transaction((tx) => {
            return itemMembershipService.patch(tx, account, id, body);
          });
        },
      );

      // delete item membership
      fastify.delete(
        '/:id',
        { schema: deleteOne, preHandler: isAuthenticated },
        async ({ user, params: { id }, query: { purgeBelow } }) => {
          const account = asDefined(user?.account);
          return db.transaction((tx) => {
            return itemMembershipService.deleteOne(tx, account, id, {
              purgeBelow,
            });
          });
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
