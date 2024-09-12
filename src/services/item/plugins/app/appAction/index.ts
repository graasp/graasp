import { FastifyPluginAsync } from 'fastify';

import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { appActionsWsHooks } from '../ws/hooks';
import { InputAppAction } from './interfaces/app-action';
import common, { create, getForMany, getForOne } from './schemas';
import { AppActionService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const appActionService = new AppActionService();

  // register app action schema
  fastify.addSchema(common);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    fastify.register(appActionsWsHooks, { appActionService });

    // create app action
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppAction> }>(
      '/:itemId/app-action',
      { schema: create, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, body }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (manager) => {
          return appActionService.post(member, buildRepositories(manager), itemId, body);
        });
      },
    );

    // get app action
    fastify.get<{ Params: { itemId: string }; Querystring: SingleItemGetFilter }>(
      '/:itemId/app-action',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query: filters }) => {
        const member = asDefined(user?.account);
        return appActionService.getForItem(member, buildRepositories(), itemId, filters);
      },
    );

    // get app action from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-action',
      { schema: getForMany, preHandler: authenticateAppsJWT },
      async ({ user, query: filters }) => {
        const member = asDefined(user?.account);
        return appActionService.getForManyItems(
          member,
          buildRepositories(),
          filters.itemId,
          filters,
        );
      },
    );
  });
};

export default plugin;
