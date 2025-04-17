import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { AppDataVisibility, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { AuthorizationService } from '../../../../authorization';
import { BasicItemService } from '../../../basic.service';
import { addMemberInAppData } from '../legacy';
import { AppDataEvent, appDataTopic } from '../ws/events';
import { checkItemIsApp } from '../ws/utils';
import { create, deleteOne, getForOne, updateOne } from './appData.schemas';
import { AppDataService } from './appData.service';
import appDataFilePlugin from './plugins/file/appData.file.controller';

const appDataPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const appDataService = resolveDependency(AppDataService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    // register websockets
    const { websockets } = fastify;
    const authorizationService = resolveDependency(AuthorizationService);
    const basicItemService = resolveDependency(BasicItemService);
    // const appDataService = resolveDependency(AppDataService);

    websockets.register(appDataTopic, async (req) => {
      const { channel: id, member } = req;
      const item = await basicItemService.get(db, member, id);
      await authorizationService.validatePermission(db, PermissionLevel.Read, member, item);
      checkItemIsApp(item);
    });

    fastify.register(appDataFilePlugin, { appDataService });

    // create app data
    fastify.post(
      '/:itemId/app-data',
      {
        schema: create,
        preHandler: authenticateAppsJWT,
      },
      async ({ user, params: { itemId }, body }) => {
        const member = asDefined(user?.account);
        const appData = await db.transaction(async (tx) => {
          return await appDataService.post(tx, member, itemId, body);
        });

        const completeAppData = addMemberInAppData(appData);
        if (appData.visibility === AppDataVisibility.Item) {
          websockets.publish(appDataTopic, itemId, AppDataEvent('post', completeAppData));
        }
        return completeAppData;
      },
    );

    // update app data
    fastify.patch(
      '/:itemId/app-data/:id',
      { schema: updateOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId }, body }) => {
        const member = asDefined(user?.account);
        const appData = await db.transaction(async (tx) => {
          return await appDataService.patch(tx, member, itemId, appDataId, body);
        });
        const completeAppData = addMemberInAppData(appData);
        if (appData.visibility === AppDataVisibility.Item) {
          websockets.publish(appDataTopic, itemId, AppDataEvent('patch', completeAppData));
        }
        return completeAppData;
      },
    );

    // delete app data
    fastify.delete(
      '/:itemId/app-data/:id',
      { schema: deleteOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId } }) => {
        const member = asDefined(user?.account);
        const appData = await db.transaction(async (tx) => {
          const appData = await appDataService.deleteOne(tx, member, itemId, appDataId);
          return appData;
        });
        if (appData.visibility === AppDataVisibility.Item) {
          websockets.publish(appDataTopic, itemId, AppDataEvent('delete', appData));
        }
        return appData.id;
      },
    );

    // get app data
    fastify.get(
      '/:itemId/app-data',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query }) => {
        const member = asDefined(user?.account);
        const appData = await appDataService.getForItem(db, member, itemId, query.type);
        return appData.map(addMemberInAppData);
      },
    );
  });
};

export default appDataPlugin;
