import { FastifyPluginAsync } from 'fastify';

import { IdParam } from '@graasp/sdk';

import { buildRepositories } from '../../../../../utils/repositories';
import { ManyItemsGetFilter } from '../interfaces/request';
import { appDataWsHooks } from '../ws/hooks';
import { AppData } from './appData';
import { InputAppData } from './interfaces/app-data';
import appDataFilePlugin from './plugins/file';
import common, { create, deleteOne, getForMany, getForOne, updateOne } from './schemas';
import { AppDataService } from './service';

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
      },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body }) => {
        const memberId = requestDetails?.memberId;

        return db.transaction(async (manager) => {
          return appDataService.post(memberId, buildRepositories(manager), itemId, body);
        });
      },
    );

    // update app data
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppData> }>(
      '/:itemId/app-data/:id',
      { schema: updateOne },
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appDataId }, body }) => {
        const memberId = requestDetails?.memberId;

        return db.transaction(async (manager) => {
          return appDataService.patch(
            memberId,
            buildRepositories(manager),
            itemId,
            appDataId,
            body,
          );
        });
      },
    );

    // delete app data
    fastify.delete<{ Params: { itemId: string } & IdParam }>(
      '/:itemId/app-data/:id',
      { schema: deleteOne },
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appDataId } }) => {
        const memberId = requestDetails?.memberId;

        return db.transaction(async (manager) => {
          return appDataService.deleteOne(memberId, buildRepositories(manager), itemId, appDataId);
        });
      },
    );

    // get app data
    fastify.get<{ Params: { itemId: string }; Querystring: { type?: string } }>(
      '/:itemId/app-data',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, query }) => {
        const memberId = requestDetails?.memberId;
        return appDataService.getForItem(memberId, buildRepositories(), itemId);
      },
    );

    // get app data from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-data',
      { schema: getForMany },
      async ({ authTokenSubject: requestDetails, query }) => {
        const memberId = requestDetails?.memberId;

        return appDataService.getForManyItems(memberId, buildRepositories(), query.itemId);
      },
    );
  });
};

export default appDataPlugin;
