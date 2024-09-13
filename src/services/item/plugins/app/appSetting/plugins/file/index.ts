import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { HttpMethod, UUID } from '@graasp/sdk';

import { resolveDependency } from '../../../../../../../di/utils';
import { asDefined } from '../../../../../../../utils/assertions';
import { Repositories, buildRepositories } from '../../../../../../../utils/repositories';
import {
  authenticateAppsJWT,
  guestAuthenticateAppsJWT,
} from '../../../../../../auth/plugins/passport';
import FileService from '../../../../../../file/service';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../../../file/utils/errors';
import { Actor, Member } from '../../../../../../member/entities/member';
import { DEFAULT_MAX_FILE_SIZE } from '../../../../file/utils/constants';
import { AppSetting } from '../../appSettings';
import { PreventUpdateAppSettingFile } from '../../errors';
import type { AppSettingService } from '../../service';
import { download, upload } from './schema';
import AppSettingFileService from './service';

export interface GraaspPluginFileOptions {
  maxFileSize?: number; // max size for an uploaded file in bytes
  appSettingService: AppSettingService;
}

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE, appSettingService } = options;

  const { db } = fastify;

  const fileService = resolveDependency(FileService);
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
    actor: Actor,
    repositories: Repositories,
    { appSetting }: { appSetting: AppSetting; itemId: string },
  ) => {
    await appSettingFileService.deleteOne(actor, repositories, appSetting);
  };
  appSettingService.hooks.setPostHook('delete', deleteHook);

  // app setting copy hook
  const hook = async (
    actor: Member,
    repositories: Repositories,
    { appSettings }: { appSettings: AppSetting[]; originalItemId: string; copyItemId: string },
  ) => {
    // copy file only if content is a file
    const isFileSetting = (a: AppSetting) => a.data[fileService.fileType];
    const toCopy = appSettings.filter(isFileSetting);
    if (toCopy.length) {
      await appSettingFileService.copyMany(actor, repositories, toCopy);
    }
  };
  appSettingService.hooks.setPostHook('copyMany', hook);

  // prevent patch on app setting file
  const patchPreHook = async (
    _actor: Actor,
    _repositories: Repositories,
    { appSetting }: { appSetting: Partial<AppSetting> },
  ) => {
    if (appSetting?.data) {
      if (appSetting.data[fileService.fileType]) {
        throw new PreventUpdateAppSettingFile(appSetting);
      }
    }
  };
  appSettingService.hooks.setPreHook('patch', patchPreHook);

  fastify.route<{ Body: unknown }>({
    method: HttpMethod.Post,
    url: '/app-settings/upload',
    schema: upload,
    preHandler: guestAuthenticateAppsJWT,
    handler: async (request) => {
      const { user } = request;
      const account = asDefined(user?.account);
      const app = asDefined(user?.app);
      // TODO: if one file fails, keep other files??? APPLY ROLLBACK
      // THEN WE SHOULD MOVE THE TRANSACTION
      return db
        .transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const file = await request.file();
          if (!file) {
            throw new UploadEmptyFileError();
          }
          return appSettingFileService.upload(account, repositories, file, app.item);
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
    // onResponse: async (request, reply) => {
    //   uploadOnResponse?.(request, reply);
    // },
  });

  fastify.get<{
    Params: { id: UUID };
    Querystring: { size?: string };
  }>(
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
        .download(member, buildRepositories(), { item: app.item, appSettingId })
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
