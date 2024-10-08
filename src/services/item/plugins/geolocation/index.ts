import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { Item } from '../../entities/Item';
import { ItemGeolocation } from './ItemGeolocation';
import {
  deleteGeolocation,
  geolocationReverse,
  geolocationSearch,
  getByItem,
  getItemsInBox,
  putGeolocation,
} from './schemas';
import { ItemGeolocationService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemGeolocationService = resolveDependency(ItemGeolocationService);

  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    fastify.get(
      '/:id/geolocation',
      {
        schema: getByItem,
        preHandler: optionalIsAuthenticated,
      },
      async ({ user, params }) => {
        return itemGeolocationService.getByItem(user?.account, buildRepositories(), params.id);
      },
    );

    fastify.get<{
      Querystring: {
        parentItemId?: Item['id'];
        lat1?: ItemGeolocation['lat'];
        lat2?: ItemGeolocation['lat'];
        lng1?: ItemGeolocation['lng'];
        lng2?: ItemGeolocation['lng'];
        keywords?: string[];
      };
    }>(
      '/geolocation',
      {
        schema: getItemsInBox,
        preHandler: optionalIsAuthenticated,
      },
      async ({ user, query }) => {
        return itemGeolocationService.getIn(user?.account, buildRepositories(), query);
      },
    );

    fastify.put<{
      Body: {
        geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> &
          Pick<Partial<ItemGeolocation>, 'addressLabel' | 'helperLabel'>;
      };
      Params: { id: Item['id'] };
    }>(
      '/:id/geolocation',
      {
        schema: putGeolocation,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, body, params }, reply) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return db.transaction(async (manager) => {
          await itemGeolocationService.put(
            member,
            buildRepositories(manager),
            params.id,
            body.geolocation,
          );
          reply.status(StatusCodes.NO_CONTENT);
        });
      },
    );

    fastify.delete<{ Params: { id: Item['id'] } }>(
      '/:id/geolocation',
      {
        schema: deleteGeolocation,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, params }, reply) => {
        return db.transaction(async (manager) => {
          const member = asDefined(user?.account);
          assertIsMember(member);
          await itemGeolocationService.delete(member, buildRepositories(manager), params.id);
          reply.status(StatusCodes.NO_CONTENT);
        });
      },
    );

    fastify.get<{ Querystring: Pick<ItemGeolocation, 'lat' | 'lng'> & { lang?: string } }>(
      '/geolocation/reverse',
      {
        schema: geolocationReverse,
        preHandler: isAuthenticated,
      },
      async ({ query }) => {
        return itemGeolocationService.getAddressFromCoordinates(buildRepositories(), query);
      },
    );

    fastify.get<{ Querystring: { query: string } & { lang?: string } }>(
      '/geolocation/search',
      {
        schema: geolocationSearch,
        preHandler: isAuthenticated,
      },
      async ({ query }) => {
        return itemGeolocationService.getSuggestionsForQuery(buildRepositories(), query);
      },
    );
  });
};

export default plugin;
