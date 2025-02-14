import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { AppDataVisibility, HttpMethod } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT, guestAuthenticateAppsJWT } from '../../../../auth/plugins/passport';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
import { addMemberInAppData } from '../legacy';
import { AppDataEvent, appDataTopic } from '../ws/events';
import { checkItemIsApp } from '../ws/utils';
import { create, deleteOne, download, getForOne, updateOne, upload } from './appData.schemas';
import { AppDataService } from './appData.service';

const appDataPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const appDataService = resolveDependency(AppDataService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    // register websockets
    const { websockets } = fastify;
    const authorizedItemService = resolveDependency(AuthorizedItemService);
    // const appDataService = resolveDependency(AppDataService);

    websockets.register(appDataTopic, async (req) => {
      const { channel: id, member } = req;
      const item = await authorizedItemService.getItemById(db, {
        accountId: member?.id,
        itemId: id,
      });
      checkItemIsApp(item);
    });

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

    fastify.route({
      method: HttpMethod.Post,
      url: '/app-data/upload',
      schema: upload,
      preHandler: guestAuthenticateAppsJWT,
      handler: async (request) => {
        const { user } = request;
        const member = asDefined(user?.account);
        const app = asDefined(user?.app);

        return db
          .transaction(async (tx) => {
            // files are saved in temporary folder in disk, they are removed when the response ends
            // necessary to get file size -> can use stream busboy only otherwise
            // only one file is uploaded
            const file = await request.file();
            if (!file) {
              throw new UploadEmptyFileError();
            }
            return addMemberInAppData(await appDataService.upload(tx, member, file, app.item));
          })
          .catch((e) => {
            console.error(e);

            // TODO rollback uploaded file

            if (e.code) {
              throw e;
            }
            throw new UploadFileUnexpectedError(e);
          });
      },
    });

    fastify.get(
      '/app-data/:id/download',
      {
        schema: download,
        preHandler: guestAuthenticateAppsJWT,
      },
      async (request) => {
        const {
          user,
          params: { id: appDataId },
        } = request;
        const member = asDefined(user?.account);
        const app = asDefined(user?.app);

        return appDataService.download(db, member, { item: app.item, appDataId }).catch((e) => {
          if (e.code) {
            throw e;
          }
          throw new DownloadFileUnexpectedError(e);
        });
      },
    );
  });
};

export default appDataPlugin;
