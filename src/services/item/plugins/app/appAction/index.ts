import { FastifyPluginAsync } from 'fastify';

import { notUndefined } from '../../../../../utils/assertions.js';
import { buildRepositories } from '../../../../../utils/repositories.js';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport/index.js';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request.js';
import { appActionsWsHooks } from '../ws/hooks.js';
import { InputAppAction } from './interfaces/app-action.js';
import common, { create, getForMany, getForOne } from './schemas.js';
import { AppActionService } from './service.js';

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
        const member = notUndefined(user?.member);
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
        const member = notUndefined(user?.member);
        return appActionService.getForItem(member, buildRepositories(), itemId, filters);
      },
    );

    // get app action from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-action',
      { schema: getForMany, preHandler: authenticateAppsJWT },
      async ({ user, query: filters }) => {
        const member = notUndefined(user?.member);
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
