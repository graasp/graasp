import { FastifyPluginAsync } from 'fastify';

import { IdParam } from '@graasp/sdk';

import { buildRepositories } from '../../../../../util/repositories';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';
import common, { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppSettingService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    files: { service: fS },
    db,
  } = fastify;

  const appSettingService = new AppSettingService();

  const fileItemType = fS.type;
  // const fTM = new FileTaskManager({ s3: s3Config, local: localConfig }, fileItemType);

  // const taskManager = new TaskManager(aSS, iS, iMS, iTM, iMTM, fileItemType, fTM);

  fastify.addSchema(common);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    fastify.addHook('preHandler', fastify.verifyBearerAuth);

    // fastify.register(GraaspFilePlugin, {
    //   prefix: '/app-settings',
    //   shouldRedirectOnDownload: false,
    //   uploadMaxFileNb: 1,
    //   fileItemType,
    //   fileConfigurations: {
    //     s3: s3Config,
    //     local: localConfig,
    //   },
    //   buildFilePath,

    //   uploadPreHookTasks: async ({ parentId: itemId }, { token }) => {
    //     const { memberId: id } = token;
    //     return taskManager.createGetTaskSequence({ id }, itemId, token);
    //   },
    //   uploadPostHookTasks: async (
    //     { filename, itemId, filepath, size, mimetype },
    //     { token },
    //     requestBody,
    //   ) => {
    //     const { memberId: id } = token;

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
    //         name: requestBody?.name ?? 'file',
    //         data: {
    //           ...data,
    //         },
    //       },
    //       itemId,
    //       token,
    //     );

    //     return tasks;
    //   },

    //   downloadPreHookTasks: async ({ itemId: appSettingId }, { token }) => {
    //     return [
    //       taskManager.createGetFileTask(
    //         { id: token.memberId },
    //         { appSettingId, fileItemType },
    //         token,
    //       ),
    //     ];
    //   },
    // });

    // TODO
    // copy app settings and related files on item copy
    // const copyTaskName = iTM.getCopyTaskName();
    // runner.setTaskPostHookHandler<Item>(
    //   copyTaskName,
    //   async ({ id: newId, type }, actor, { log, handler }, { original }) => {
    //     try {
    //       if (!newId || type !== ItemType.APP) return;

    //       const appSettings = await aSS.getForItem(original.id, handler);
    //       for (const appS of appSettings) {
    //         const copyData = {
    //           name: appS.name,
    //           data: appS.data,
    //           itemId: newId,
    //           creator: actor.id,
    //         };
    //         const newSetting = await aSS.create(copyData, handler);

    //         // copy file only if content is a file
    //         const isFileSetting = appS.data.type === fileItemType;
    //         if (isFileSetting) {
    //           // create file data object
    //           const newFilePath = buildFilePath();
    //           const newFileData = buildFileItemData({
    //             filepath: newFilePath,
    //             name: appS.data.name,
    //             type: appS.data.type,
    //             filename: appS.data.extra[fileItemType].name,
    //             size: appS.data.extra[fileItemType].size,
    //             mimetype: appS.data.extra[fileItemType].mimetype,
    //           });

    //           // set to new app setting
    //           copyData.data = newFileData;

    //           // run copy task
    //           const originalFileExtra = appS.data.extra[fileItemType] as FileProperties;
    //           const fileCopyData = {
    //             newId: newSetting.id,
    //             newFilePath,
    //             originalPath: originalFileExtra.path,
    //             mimetype: originalFileExtra.mimetype,
    //           };
    //           const fileCopyTask = fTM.createCopyFileTask(actor, fileCopyData);
    //           await runner.runSingle(fileCopyTask);

    //           // update new setting with file data
    //           await aSS.update(newSetting.id, { data: newFileData }, handler);
    //         }
    //       }
    //     } catch (err) {
    //       log.error(err);
    //     }
    //   },
    // );

    // create app setting
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppSetting> }>(
      '/:itemId/app-settings',
      {
        schema: create,
      },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body, log }) => {
        const { memberId } = requestDetails;
        return db.transaction(async (manager) => {
          return appSettingService.post(memberId, buildRepositories(manager), itemId, body);
        });
      },
    );

    // update app setting
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppSetting> }>(
      '/:itemId/app-settings/:id',
      { schema: updateOne },
      async ({
        authTokenSubject: requestDetails,
        params: { itemId, id: appSettingId },
        body,
        log,
      }) => {
        const { memberId } = requestDetails;
        return db.transaction(async (manager) => {
          return appSettingService.patch(
            memberId,
            buildRepositories(manager),
            itemId,
            appSettingId,
            body,
          );
        });
      },
    );

    // delete app setting
    fastify.delete<{ Params: { itemId: string } & IdParam }>(
      '/:itemId/app-settings/:id',
      { schema: deleteOne },
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appSettingId }, log }) => {
        const { memberId } = requestDetails;

        return db.transaction(async (manager) => {
          return appSettingService.deleteOne(
            memberId,
            buildRepositories(manager),
            itemId,
            appSettingId,
          );
        });
      },
    );

    // get app settings
    fastify.get<{ Params: { itemId: string } }>(
      '/:itemId/app-settings',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, log }) => {
        const { memberId } = requestDetails;
        return appSettingService.getForItem(memberId, buildRepositories(), itemId);
      },
    );
  });
};

export default plugin;
