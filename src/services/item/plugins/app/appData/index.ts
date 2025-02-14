import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { HttpMethod } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT, guestAuthenticateAppsJWT } from '../../../../auth/plugins/passport';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
import { addMemberInAppData } from '../legacy';
import { appDataWsHooks } from '../ws/hooks';
import { create, deleteOne, download, getForOne, updateOne, upload } from './schemas';
import { AppDataService } from './service';

const appDataPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const appDataService = resolveDependency(AppDataService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

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
        return db.transaction(async (manager) => {
          return addMemberInAppData(
            await appDataService.post(member, buildRepositories(manager), itemId, body),
          );
        });
      },
    );

    // update app data
    fastify.patch(
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
    fastify.delete(
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
    fastify.get(
      '/:itemId/app-data',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query }) => {
        const member = asDefined(user?.account);
        return (
          await appDataService.getForItem(member, buildRepositories(), itemId, query.type)
        ).map(addMemberInAppData);
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
          .transaction(async (manager) => {
            const repositories = buildRepositories(manager);

            // files are saved in temporary folder in disk, they are removed when the response ends
            // necessary to get file size -> can use stream busboy only otherwise
            // only one file is uploaded
            const file = await request.file();
            if (!file) {
              throw new UploadEmptyFileError();
            }
            return addMemberInAppData(
              await appDataService.upload(member, repositories, file, app.item),
            );
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

        return appDataService
          .download(member, buildRepositories(), { item: app.item, appDataId })
          .catch((e) => {
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
