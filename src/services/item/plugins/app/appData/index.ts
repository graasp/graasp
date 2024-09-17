import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../../di/utils';
import { IdParam } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { addMemberInAppData } from '../legacy';
import { appDataWsHooks } from '../ws/hooks';
import { AppData } from './appData';
import { InputAppData } from './interfaces/app-data';
import appDataFilePlugin from './plugins/file';
import common, { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppDataService } from './service';

const appDataPlugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // register app data schema
  fastify.addSchema(common);

  const appDataService = resolveDependency(AppDataService);

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
        const member = asDefined(user?.account);
        return db.transaction(async (manager) => {
          return addMemberInAppData(
            await appDataService.post(member, buildRepositories(manager), itemId, body),
          );
        });
      },
    );

    // update app data
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppData> }>(
      '/:itemId/app-data/:id',
      { schema: updateOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId }, body }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (manager) => {
          return addMemberInAppData(
            await appDataService.patch(member, buildRepositories(manager), itemId, appDataId, body),
          );
        });
      },
    );

    // delete app data
    fastify.delete<{ Params: { itemId: string } & IdParam }>(
      '/:itemId/app-data/:id',
      { schema: deleteOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId } }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (manager) => {
          const { id } = await appDataService.deleteOne(
            member,
            buildRepositories(manager),
            itemId,
            appDataId,
          );
          return id;
        });
      },
    );

    // get app data
    fastify.get<{ Params: { itemId: string }; Querystring: { type?: string } }>(
      '/:itemId/app-data',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query }) => {
        const member = asDefined(user?.account);
        return (
          await appDataService.getForItem(member, buildRepositories(), itemId, query.type)
        ).map(addMemberInAppData);
      },
    );
  });
};

export default appDataPlugin;
