import { UUID } from 'crypto';

import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, PermissionLevel } from '@graasp/sdk';

import { buildRepositories } from '../../utils/repositories';
import { PurgeBelowParam } from './interfaces/requests';
import common, { create, createMany, deleteOne, getItems, updateOne } from './schemas';
import ItemMembershipService from './service';
import { membershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items, mailer } = fastify;
  const itemMembershipService = new ItemMembershipService(items.service, mailer);
  fastify.decorate('memberships', { service: itemMembershipService });

  // schemas
  fastify.addSchema(common);

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
        { schema: getItems, preHandler: fastify.attemptVerifyAuthentication },
        async ({ member, query: { itemId: ids } }) => {
          return itemMembershipService.getForManyItems(member, buildRepositories(), ids);
        },
      );

      // create item membership
      fastify.post<{
        Querystring: { itemId: string };
        Body: { permission: PermissionLevel; memberId: string };
      }>(
        '/',
        { schema: create, preHandler: fastify.verifyAuthentication },
        async ({ member, query: { itemId }, body }) => {
          return db.transaction((manager) => {
            return itemMembershipService.post(member, buildRepositories(manager), {
              permission: body.permission,
              itemId,
              memberId: body.memberId,
            });
          });
        },
      );

      // create many item memberships
      fastify.post<{
        Params: { itemId: string };
        Body: { memberships: { permission: PermissionLevel; memberId: UUID }[] };
      }>(
        '/:itemId',
        { schema: createMany, preHandler: fastify.verifyAuthentication },
        async ({ member, params: { itemId }, body }) => {
          // BUG: because we use this call to save csv member
          // we have to return immediately
          // solution: it's probably simpler to upload a csv and handle it in the back
          return db.transaction((manager) => {
            return itemMembershipService.postMany(
              member,
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
        Body: { memberId: UUID; itemId: UUID; permission: PermissionLevel };
      }>(
        '/:id',
        {
          schema: updateOne,
          preHandler: fastify.verifyAuthentication,
        },
        async ({ member, params: { id }, body }) => {
          return db.transaction((manager) => {
            return itemMembershipService.patch(member, buildRepositories(manager), id, body);
          });
        },
      );

      // delete item membership
      fastify.delete<{ Params: IdParam; Querystring: PurgeBelowParam }>(
        '/:id',
        { schema: deleteOne, preHandler: fastify.verifyAuthentication },
        async ({ member, params: { id }, query: { purgeBelow } }) => {
          return db.transaction((manager) => {
            return itemMembershipService.deleteOne(member, buildRepositories(manager), id, {
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
