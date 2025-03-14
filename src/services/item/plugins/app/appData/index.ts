import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils.js';
import { db } from '../../../../../drizzle/db.js';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox.js';
import { asDefined } from '../../../../../utils/assertions.js';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport/index.js';
import { addMemberInAppData } from '../legacy.js';
import { appDataWsHooks } from '../ws/hooks.js';
import { AppDataService } from './appData.service.js';
import appDataFilePlugin from './plugins/file/index.js';
import { create, deleteOne, getForOne, updateOne } from './schemas.js';

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
        await db.transaction(async (tx) => {
          await appDataService.post(tx, member, itemId, body);
        });
      },
    );

    // update app data
    fastify.patch(
      '/:itemId/app-data/:id',
      { schema: updateOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId, id: appDataId }, body }, reply) => {
        const member = asDefined(user?.account);
        await db.transaction(async (tx) => {
          await appDataService.patch(tx, member, itemId, appDataId, body);
        });
        reply.status(StatusCodes.NO_CONTENT);
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
        const appData = await appDataService.getForItem(db, member, itemId, query.type);
        return appData.map(addMemberInAppData);
      },
    );
  });
};

export default appDataPlugin;
