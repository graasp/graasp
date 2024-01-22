import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { Item } from '../../entities/Item';
import {
  deleteGeolocation,
  getForItem,
  getItemsInBox,
  postItemWithGeolocation,
  putGeolocation,
} from './schemas';
import { ItemGeolocationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    items: { service: iS },
  } = fastify;

  const itemGeolocationService = new ItemGeolocationService(iS);

  fastify.register(async function (fastify) {
    fastify.get<{ Params: { id: Item['id'] } }>(
      '/:id/geolocation',
      {
        schema: getForItem,
        preHandler: fastify.attemptVerifyAuthentication,
      },
      async ({ member, params }) => {
        return itemGeolocationService.getForItem(member, buildRepositories(), params.id);
      },
    );

    fastify.get<{ Querystring: { lat1: number; lat2: number; lng1: number; lng2: number } }>(
      '/geolocation',
      {
        schema: getItemsInBox,
        preHandler: fastify.attemptVerifyAuthentication,
      },
      async ({ member, query }) => {
        return itemGeolocationService.getIn(member, buildRepositories(), query);
      },
    );

    fastify.put<{ Body: { lat: number; lng: number }; Params: { id: Item['id'] } }>(
      '/:id/geolocation',
      {
        schema: putGeolocation,
        preHandler: fastify.verifyAuthentication,
      },
      async ({ member, body, params }) => {
        return db.transaction((manager) => {
          return itemGeolocationService.put(
            member,
            buildRepositories(manager),
            params.id,
            body.lat,
            body.lng,
          );
        });
      },
    );

    // add item from map
    fastify.post<{ Body: { lat: number; lng: number }; Querystring: { id?: Item['id'] } }>(
      '/map',
      {
        schema: postItemWithGeolocation,
        preHandler: fastify.verifyAuthentication,
      },
      async ({ member, body, query }) => {
        return db.transaction((manager) => {
          return itemGeolocationService.postItemWithGeolocation(
            member,
            buildRepositories(manager),
            body,
            query.id,
          );
        });
      },
    );

    fastify.delete<{ Params: { id: Item['id'] } }>(
      '/:id/geolocation',
      {
        schema: deleteGeolocation,
        preHandler: fastify.verifyAuthentication,
      },
      async ({ member, params }) => {
        return db.transaction((manager) => {
          return itemGeolocationService.delete(member, buildRepositories(manager), params.id);
        });
      },
    );
  });
};

export default plugin;
