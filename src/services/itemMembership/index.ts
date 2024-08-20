import { UUID } from 'crypto';

import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { IdParam } from '../../types';
import { notUndefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { PurgeBelowParam } from './interfaces/requests';
import MembershipRequestAPI from './plugins/MembershipRequest';
import common, { create, createMany, deleteOne, getItems, updateOne } from './schemas';
import { ItemMembershipService } from './service';
import { membershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const itemMembershipService = resolveDependency(ItemMembershipService);

  // schemas
  fastify.addSchema(common);

  fastify.register(MembershipRequestAPI);

  // routes
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.register(membershipWsHooks);

      // get many item's memberships
      // returns empty for item not found
      fastify.get<{ Querystring: { itemId: string[] } }>(
        '/',
        { schema: getItems, preHandler: optionalIsAuthenticated },
        async ({ user, query: { itemId: ids } }) => {
          return itemMembershipService.getForManyItems(user?.account, buildRepositories(), ids);
        },
      );

      // create item membership
      fastify.post<{
        Querystring: { itemId: string };
        Body: { permission: PermissionLevel; accountId: string };
      }>(
        '/',
        { schema: create, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
        async ({ user, query: { itemId }, body }) => {
          const account = notUndefined(user?.account);
          return db.transaction((manager) => {
            return itemMembershipService.post(account, buildRepositories(manager), {
              permission: body.permission,
              itemId,
              memberId: body.accountId,
            });
          });
        },
      );

      // create many item memberships
      fastify.post<{
        Params: { itemId: string };
        Body: { memberships: { permission: PermissionLevel; accountId: UUID }[] };
      }>(
        '/:itemId',
        { schema: createMany, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
        async ({ user, params: { itemId }, body }) => {
          const account = notUndefined(user?.account);
          // BUG: because we use this call to save csv member
          // we have to return immediately
          // solution: it's probably simpler to upload a csv and handle it in the back
          return db.transaction((manager) => {
            return itemMembershipService.postMany(
              account,
              buildRepositories(manager),
              body.memberships,
              itemId,
            );
          });
        },
      );

      // update item membership
      fastify.patch<{
        Params: IdParam;
        Body: { accountId: UUID; itemId: UUID; permission: PermissionLevel };
      }>(
        '/:id',
        {
          schema: updateOne,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, params: { id }, body }) => {
          const account = notUndefined(user?.account);
          return db.transaction((manager) => {
            return itemMembershipService.patch(account, buildRepositories(manager), id, body);
          });
        },
      );

      // delete item membership
      fastify.delete<{ Params: IdParam; Querystring: PurgeBelowParam }>(
        '/:id',
        { schema: deleteOne, preHandler: isAuthenticated },
        async ({ user, params: { id }, query: { purgeBelow } }) => {
          const account = notUndefined(user?.account);
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
