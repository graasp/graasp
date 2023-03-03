import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../../util/repositories';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { InputAppAction } from './interfaces/app-action';
import common, { create, getForMany, getForOne } from './schemas';
import { AppActionService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const appActionService = new AppActionService();

  fastify.addSchema(common);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', fastify.verifyBearerAuth);

    // create app action
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppAction> }>(
      '/:itemId/app-action',
      { schema: create },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body, log }) => {
        const { memberId: id } = requestDetails;

        return db.transaction(async (manager) => {
          return appActionService.post(id, buildRepositories(manager), itemId, body);
        });
      },
    );

    // get app action
    fastify.get<{ Params: { itemId: string }; Querystring: SingleItemGetFilter }>(
      '/:itemId/app-action',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, query: filters, log }) => {
        const { memberId: id } = requestDetails;

        return appActionService.getForItem(id, buildRepositories(), itemId, filters);
      },
    );

    // get app action from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-action',
      { schema: getForMany },
      async ({ authTokenSubject: requestDetails, query: filters, log }) => {
        const { memberId: id } = requestDetails;
        return appActionService.getForManyItems(id, buildRepositories(), filters.itemId, filters);
      },
    );
  });
};

export default plugin;
