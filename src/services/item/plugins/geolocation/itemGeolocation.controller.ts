import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import {
  deleteGeolocation,
  geolocationReverse,
  geolocationSearch,
  getByItem,
  getItemsInBox,
  putGeolocation,
} from './itemGeolocation.schemas';
import { ItemGeolocationService } from './itemGeolocation.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemGeolocationService = resolveDependency(ItemGeolocationService);
  const itemService = resolveDependency(ItemService);

  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    fastify.get(
      '/:id/geolocation',
      {
        schema: getByItem,
        preHandler: optionalIsAuthenticated,
      },
      async ({ user, params }) => {
        const actor = user?.account;
        const geoloc = await itemGeolocationService.getByItem(db, actor, params.id);

        if (geoloc) {
          // return packed item of related item (could be parent)
          const geolocPackedItem = await itemService.getPacked(db, actor, geoloc.item.id);
          return { ...geoloc, item: geolocPackedItem };
        }
        return null;
      },
    );

    fastify.get(
      '/geolocation',
      {
        schema: getItemsInBox,
        preHandler: optionalIsAuthenticated,
      },
      async ({ user, query }) => {
        return itemGeolocationService.getIn(db, user?.account, query);
      },
    );

    fastify.put(
      '/:id/geolocation',
      {
        schema: putGeolocation,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, body, params }, reply) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        await db.transaction(async (tx) => {
          await itemGeolocationService.put(tx, member, params.id, body.geolocation);
        });
        reply.status(StatusCodes.NO_CONTENT);
      },
    );

    fastify.delete(
      '/:id/geolocation',
      {
        schema: deleteGeolocation,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, params }, reply) => {
        await db.transaction(async (tx) => {
          const member = asDefined(user?.account);
          assertIsMember(member);
          await itemGeolocationService.delete(tx, member, params.id);
        });
        reply.status(StatusCodes.NO_CONTENT);
      },
    );

    fastify.get(
      '/geolocation/reverse',
      {
        schema: geolocationReverse,
        preHandler: isAuthenticated,
      },
      async ({ query }) => {
        return itemGeolocationService.getAddressFromCoordinates(db, query);
      },
    );

    fastify.get(
      '/geolocation/search',
      {
        schema: geolocationSearch,
        preHandler: isAuthenticated,
      },
      async ({ query }) => {
        return itemGeolocationService.getSuggestionsForQuery(db, query);
      },
    );
  });
};

export default plugin;
