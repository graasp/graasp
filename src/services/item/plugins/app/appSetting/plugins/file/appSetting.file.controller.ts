import { fastifyMultipart } from '@fastify/multipart';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../../../di/utils';
import { type DBConnection, db } from '../../../../../../../drizzle/db';
import { type AppSettingRaw } from '../../../../../../../drizzle/types';
import type { MaybeUser } from '../../../../../../../types';
import { asDefined } from '../../../../../../../utils/assertions';
import {
  authenticateAppsJWT,
  guestAuthenticateAppsJWT,
} from '../../../../../../auth/plugins/passport';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../../../file/utils/errors';
import { DEFAULT_MAX_FILE_SIZE } from '../../../../file/utils/constants';
import type { AppSettingService } from '../../appSetting.service';
import { download, upload } from './appSetting.file.schema';
import AppSettingFileService from './appSetting.file.service';

export interface GraaspPluginFileOptions {
  maxFileSize?: number; // max size for an uploaded file in bytes
  appSettingService: AppSettingService;
}

const basePlugin: FastifyPluginAsyncTypebox<GraaspPluginFileOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE, appSettingService } = options;

  const appSettingFileService = resolveDependency(AppSettingFileService);

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 5, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: maxFileSize, // For multipart forms, the max file size (Default: Infinity).
      files: 1, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  // register post delete handler to remove the file object after item delete
  const deleteHook = async (
    actor: MaybeUser,
    dbConnection: DBConnection,
    { appSetting }: { appSetting: AppSettingRaw; itemId: string },
  ) => {
    await appSettingFileService.deleteOne(db, actor, appSetting);
  };
  appSettingService.hooks.setPostHook('delete', deleteHook);

  // app setting copy hook
  const hook = async (
    actor: MaybeUser,
    dbConnection: DBConnection,
    {
      appSettings,
    }: {
      appSettings: AppSettingRaw[];
      originalItemId: string;
      copyItemId: string;
    },
  ) => {
    if (!actor) {
      return;
    }

    // copy file only if content is a file
    const isFileSetting = (a) => a.data['file'];
    const toCopy = appSettings.filter(isFileSetting);
    if (toCopy.length) {
      await appSettingFileService.copyMany(db, actor.id, toCopy);
    }
  };
  appSettingService.hooks.setPostHook('copyMany', hook);

  fastify.post(
    '/app-settings/upload',
    {
      schema: upload,
      preHandler: guestAuthenticateAppsJWT,
    },
    async (request) => {
      const { user } = request;
      const account = asDefined(user?.account);
      const app = asDefined(user?.app);

      return await db
        .transaction(async (tx) => {
          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const file = await request.file();
          if (!file) {
            throw new UploadEmptyFileError();
          }
          return appSettingFileService.upload(tx, account, file, app.item);
        })
        .catch((e) => {
          request.log.error(e);

          // TODO rollback uploaded file

          if (e.code) {
            throw e;
          }
          throw new UploadFileUnexpectedError(e);
        });
    },
  );

  fastify.get(
    '/app-settings/:id/download',
    {
      schema: download,
      preHandler: authenticateAppsJWT,
    },
    async (request) => {
      const {
        user,
        params: { id: appSettingId },
      } = request;
      const member = asDefined(user?.account);
      const app = asDefined(user?.app);

      return appSettingFileService
        .download(db, member, { item: app.item, appSettingId })
        .catch((e) => {
          if (e.code) {
            throw e;
          }
          throw new DownloadFileUnexpectedError(e);
        });
    },
  );
};

export default basePlugin;
