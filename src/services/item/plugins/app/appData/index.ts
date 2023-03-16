import { FastifyPluginAsync } from 'fastify';

import { FileItemType, IdParam } from '@graasp/sdk';

import { buildRepositories } from '../../../../../util/repositories';
import { AppDataVisibility } from '../interfaces/app-details';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { APP_DATA_TYPE_FILE } from '../util/constants';
import { AppData } from './appData';
import { InputAppData } from './interfaces/app-data';
import common, { create, deleteOne, getForMany, getForOne, updateOne } from './schemas';
import { AppDataService } from './service';

const appDataPlugin: FastifyPluginAsync = async (fastify) => {
  const { db, files: {service:fS} } = fastify;
  const fileItemType = fS.type;

  fastify.addSchema(common);

  const appDataService = new AppDataService();

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    // TODO: FILE DATA

    // fastify.register(GraaspFilePlugin, {
    //   fileItemType,
    //   uploadMaxFileNb: 1,
    //   shouldRedirectOnDownload: false,
    //   fileConfigurations: fileOptions,
    //   buildFilePath,

    //   uploadPreHookTasks: async ({ parentId: itemId }, { token }) => {
    //     const { member: id } = token;
    //     return [
    //       taskManager.createGetTask(
    //         { id },
    //         itemId,
    //         { visibility: AppDataVisibility.MEMBER },
    //         token,
    //       ),
    //     ];
    //   },
    //   uploadPostHookTasks: async (
    //     { filename, itemId, filepath, size, mimetype },
    //     { token },
    //     fileBody = {},
    //   ) => {
    //     const { member: id } = token;

    //     // remove undefined values
    //     const values = { ...fileBody };
    //     Object.keys(values).forEach((key) => values[key] === undefined && delete values[key]);

    //     const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);
    //     const data = buildFileItemData({
    //       name,
    //       type: fileItemType,
    //       filename,
    //       filepath,
    //       size,
    //       mimetype,
    //     });

    //     const tasks = taskManager.createCreateTaskSequence(
    //       { id },
    //       {
    //         data: {
    //           ...data,
    //         },
    //         type: APP_DATA_TYPE_FILE,
    //         visibility: 'member',
    //         ...values,
    //       },
    //       itemId,
    //       token,
    //     );

    //     return tasks;
    //   },

    //   downloadPreHookTasks: async ({ itemId }, { token }) => {
    //     return [
    //       taskManager.createGetFileTask(
    //         { id: token.member },
    //         { appDataId: itemId, fileItemType },
    //         token,
    //       ),
    //     ];
    //   },
    // });

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
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appDataId }, log }) => {
        const memberId = requestDetails?.memberId;

        return db.transaction(async (manager) => {
          return appDataService.deleteOne(memberId, buildRepositories(manager), itemId, appDataId);
        });
      },
    );

    // get app data
    fastify.get<{ Params: { itemId: string }; Querystring: SingleItemGetFilter }>(
      '/:itemId/app-data',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, query: filters, log }) => {
        const memberId = requestDetails?.memberId;
        return appDataService.getForItem(memberId, buildRepositories(), itemId, filters);
      },
    );

    // get app data from multiple items
    fastify.get<{ Querystring: ManyItemsGetFilter }>(
      '/app-data',
      { schema: getForMany },
      async ({ authTokenSubject: requestDetails, query: filters, log }) => {
        const memberId = requestDetails?.memberId;

        return appDataService.getForManyItems(
          memberId,
          buildRepositories(),
          filters.itemId,
          filters,
        );
      },
    );
  });
};

export default appDataPlugin;
