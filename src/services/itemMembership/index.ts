import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import MembershipRequestAPI from './plugins/MembershipRequest';
import { create, createMany, deleteOne, getForItem, updateOne } from './schemas';
import { ItemMembershipService } from './service';
import { membershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemMembershipService = resolveDependency(ItemMembershipService);

  fastify.register(MembershipRequestAPI, { prefix: '/items/:itemId/memberships/requests' });

  // routes
  fastify.register(
    async function (fastify: FastifyInstanceTypebox) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.register(membershipWsHooks);

      fastify.get(
        '/:itemId',
        { schema: getForItem, preHandler: optionalIsAuthenticated },
        async ({ user, params: { itemId } }) => {
          return itemMembershipService.getForItem(user?.account, buildRepositories(), itemId);
        },
      );

      // create item membership
      fastify.post(
        '/',
        { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
        async ({ user, query: { itemId }, body }) => {
          const account = asDefined(user?.account);
          return db.transaction((manager) => {
            return itemMembershipService.create(account, buildRepositories(manager), {
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
        { schema: createMany, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
        async ({ user, params: { itemId }, body }) => {
          const account = asDefined(user?.account);
          // BUG: because we use this call to save csv member
          // we have to return immediately
          // solution: it's probably simpler to upload a csv and handle it in the back
          return db.transaction((manager) => {
            return itemMembershipService.createMany(
              account,
              buildRepositories(manager),
              body.memberships,
              itemId,
            );
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
          return db.transaction((manager) => {
            return itemMembershipService.patch(account, buildRepositories(manager), id, body);
          });
        },
      );

      // delete item membership
      fastify.delete(
        '/:id',
        { schema: deleteOne, preHandler: isAuthenticated },
        async ({ user, params: { id }, query: { purgeBelow } }) => {
          const account = asDefined(user?.account);
          return db.transaction((manager) => {
            return itemMembershipService.deleteOne(account, buildRepositories(manager), id, {
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
