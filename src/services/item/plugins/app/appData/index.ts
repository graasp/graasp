import { FastifyPluginAsync } from 'fastify';

import { IdParam } from '../../../../../types.js';
import { notUndefined } from '../../../../../utils/assertions.js';
import { buildRepositories } from '../../../../../utils/repositories.js';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport/index.js';
import { ManyItemsGetFilter } from '../interfaces/request.js';
import { appDataWsHooks } from '../ws/hooks.js';
import { AppData } from './appData.js';
import { InputAppData } from './interfaces/app-data.js';
import appDataFilePlugin from './plugins/file/index.js';
import common, { create, deleteOne, getForMany, getForOne, updateOne } from './schemas.js';
import { AppDataService } from './service.js';

const appDataPlugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // register app data schema
  fastify.addSchema(common);

  const appDataService = new AppDataService();

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    fastify.register(appDataFilePlugin, { appDataService });
    fastify.register(appDataWsHooks, { appDataService });

    // create app data
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppData> }>(
      '/:itemId/app-data',
      {
        schema: create,
        preHandler: authenticateAppsJWT,
      },
      async ({ user, params: { itemId }, body }) => {
        return db.transaction(async (manager) => {
          const member = notUndefined(user?.member);
          return appDataService.post(member, buildRepositories(manager), itemId, body);
        });
      },
    );

    // update app data
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppData> }>(
      '/:itemId/app-data/:id',
      { schema: updateOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId }, body }) => {
        const member = notUndefined(user?.member);
        return db.transaction(async (manager) => {
          return appDataService.patch(member, buildRepositories(manager), itemId, appDataId, body);
        });
      },
    );

    // delete app data
    fastify.delete<{ Params: { itemId: string } & IdParam }>(
      '/:itemId/app-data/:id',
      { schema: deleteOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId } }) => {
        const member = notUndefined(user?.member);
        return db.transaction(async (manager) => {
          return appDataService.deleteOne(member, buildRepositories(manager), itemId, appDataId);
        });
      },
    );

    // get app data
    fastify.get<{ Params: { itemId: string }; Querystring: { type?: string } }>(
      '/:itemId/app-data',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query }) => {
        const member = notUndefined(user?.member);
        return appDataService.getForItem(member, buildRepositories(), itemId, query.type);
      },
    );

    // get app data from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-data',
      { schema: getForMany, preHandler: authenticateAppsJWT },
      async ({ user, query }) => {
        const member = notUndefined(user?.member);
        return appDataService.getForManyItems(member, buildRepositories(), query.itemId);
      },
    );
  });
};

export default appDataPlugin;
