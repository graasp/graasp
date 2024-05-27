import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { GEOLOCATION_API_KEY } from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../../../auth/plugins/passport';
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

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    items: { service: iS },
  } = fastify;

  const itemGeolocationService = new ItemGeolocationService(iS, GEOLOCATION_API_KEY);

  fastify.register(async function (fastify) {
    fastify.get<{ Params: { id: Item['id'] } }>(
      '/:id/geolocation',
      {
        schema: getByItem,
        preHandler: optionalAuthenticated,
      },
      async ({ user, params }) => {
        return itemGeolocationService.getByItem(user?.member, buildRepositories(), params.id);
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
        preHandler: optionalAuthenticated,
      },
      async ({ user, query }) => {
        return itemGeolocationService.getIn(user?.member, buildRepositories(), query);
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
        preHandler: authenticated,
      },
      async ({ user, body, params }, reply) => {
        return db.transaction(async (manager) => {
          await itemGeolocationService.put(
            user!.member!,
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
        preHandler: authenticated,
      },
      async ({ user, params }, reply) => {
        return db.transaction(async (manager) => {
          await itemGeolocationService.delete(user!.member, buildRepositories(manager), params.id);
          reply.status(StatusCodes.NO_CONTENT);
        });
      },
    );

    fastify.get<{ Querystring: Pick<ItemGeolocation, 'lat' | 'lng'> & { lang?: string } }>(
      '/geolocation/reverse',
      {
        schema: geolocationReverse,
        preHandler: authenticated,
      },
      async ({ user, query }) => {
        return itemGeolocationService.getAddressFromCoordinates(
          user!.member!,
          buildRepositories(),
          query,
        );
      },
    );

    fastify.get<{ Querystring: { query: string } & { lang?: string } }>(
      '/geolocation/search',
      {
        schema: geolocationSearch,
        preHandler: authenticated,
      },
      async ({ user, query }) => {
        return itemGeolocationService.getSuggestionsForQuery(
          user!.member!,
          buildRepositories(),
          query,
        );
      },
    );
  });
};

export default plugin;
