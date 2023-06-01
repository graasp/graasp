import { UUID } from 'crypto';

import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, PermissionLevel } from '@graasp/sdk';

import { WEBSOCKETS_PLUGIN } from '../../utils/config';
import { buildRepositories } from '../../utils/repositories';
import { ItemMembership } from './entities/ItemMembership';
import { PurgeBelowParam } from './interfaces/requests';
import common, { create, createMany, deleteAll, deleteOne, getItems, updateOne } from './schemas';
import ItemMembershipService from './service';

// import { registerItemMembershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    items: { service: itemService },
    mailer,
    hosts,
  } = fastify;
  const itemMembershipService = new ItemMembershipService(itemService, hosts, fastify.mailer);

  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // if (WEBSOCKETS_PLUGIN) {
      //   registerItemMembershipWsHooks(
      //     websockets,
      //     runner,
      //     itemsDbService,
      //     dbService,
      //     taskManager,
      //     db.pool,
      //   );
      // }

      // get many item's memberships
      // returns empty for item not found
      fastify.get<{ Querystring: { itemId: string[] } }>(
        '/',
        { schema: getItems, preHandler: fastify.fetchMemberInSession },
        async ({ member, query: { itemId: ids }, log }) => {
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
        async ({ member, query: { itemId }, body, log }) => {
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
        async ({ member, params: { itemId }, body, log }, reply) => {
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
        async ({ member, params: { id }, body, log }) => {
          return db.transaction((manager) => {
            return itemMembershipService.patch(member, buildRepositories(manager), id, body);
          });
        },
      );

      // delete item membership
      fastify.delete<{ Params: IdParam; Querystring: PurgeBelowParam }>(
        '/:id',
        { schema: deleteOne, preHandler: fastify.verifyAuthentication },
        async ({ member, params: { id }, query: { purgeBelow }, log }) => {
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
