import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { Item } from '../../entities/Item';
import { ItemGeolocation } from './ItemGeolocation';
import { deleteGeolocation, getByItem, getItemsInBox, putGeolocation } from './schemas';
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
        schema: getByItem,
        preHandler: fastify.attemptVerifyAuthentication,
      },
      async ({ member, params }) => {
        return itemGeolocationService.getByItem(member, buildRepositories(), params.id);
      },
    );

    fastify.get<{
      Querystring: {
        lat1: ItemGeolocation['lat'];
        lat2: ItemGeolocation['lat'];
        lng1: ItemGeolocation['lng'];
        lng2: ItemGeolocation['lng'];
        search: string[];
      };
    }>(
      '/geolocation',
      {
        schema: getItemsInBox,
        preHandler: fastify.attemptVerifyAuthentication,
      },
      async ({ member, query }) => {
        return itemGeolocationService.getIn(member, buildRepositories(), query);
      },
    );

    fastify.put<{
      Body: { geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> };
      Params: { id: Item['id'] };
    }>(
      '/:id/geolocation',
      {
        schema: putGeolocation,
        preHandler: fastify.verifyAuthentication,
      },
      async ({ member, body, params }, reply) => {
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
        preHandler: fastify.verifyAuthentication,
      },
      async ({ member, params }, reply) => {
        return db.transaction(async (manager) => {
          await itemGeolocationService.delete(member, buildRepositories(manager), params.id);
          reply.status(StatusCodes.NO_CONTENT);
        });
      },
    );
  });
};

export default plugin;
