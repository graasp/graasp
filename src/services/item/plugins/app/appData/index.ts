import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { addMemberInAppData } from '../legacy';
import { appDataWsHooks } from '../ws/hooks';
import appDataFilePlugin from './plugins/file';
import { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppDataService } from './service';

const appDataPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const appDataService = resolveDependency(AppDataService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    fastify.register(appDataFilePlugin, { appDataService });
    fastify.register(appDataWsHooks, { appDataService });

    // create app data
    fastify.post(
      '/:itemId/app-data',
      {
        schema: create,
        preHandler: authenticateAppsJWT,
      },
      async ({ user, params: { itemId }, body }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (tx) => {
          return addMemberInAppData(await appDataService.post(tx, member, itemId, body));
        });
      },
    );

    // update app data
    fastify.patch(
      '/:itemId/app-data/:id',
      { schema: updateOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId }, body }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (tx) => {
          return addMemberInAppData(
            await appDataService.patch(tx, member, itemId, appDataId, body),
          );
        });
      },
    );

    // delete app data
    fastify.delete(
      '/:itemId/app-data/:id',
      { schema: deleteOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId } }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (tx) => {
          const { id } = await appDataService.deleteOne(tx, member, itemId, appDataId);
          return id;
        });
      },
    );

    // get app data
    fastify.get(
      '/:itemId/app-data',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query }) => {
        const member = asDefined(user?.account);
        return (await appDataService.getForItem(db, member, itemId, query.type)).map(
          addMemberInAppData,
        );
      },
    );
  });
};

export default appDataPlugin;
