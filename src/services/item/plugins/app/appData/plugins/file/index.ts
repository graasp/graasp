import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { HttpMethod, UUID } from '@graasp/sdk';

import { resolveDependency } from '../../../../../../../di/utils';
import { IdParam } from '../../../../../../../types';
import { notUndefined } from '../../../../../../../utils/assertions';
import { Repositories, buildRepositories } from '../../../../../../../utils/repositories';
import { guestAuthenticateAppsJWT } from '../../../../../../auth/plugins/passport';
import FileService from '../../../../../../file/service';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../../../file/utils/errors';
import { Actor, Member } from '../../../../../../member/entities/member';
import { AppData } from '../../appData';
import { PreventUpdateAppDataFile } from '../../errors';
import { AppDataService } from '../../service';
import { download, upload } from './schema';
import AppDataFileService from './service';

export interface GraaspPluginFileOptions {
  maxFileSize?: number; // max size for an uploaded file in bytes

  appDataService: AppDataService;
}

export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,

    appDataService,
  } = options;

  const { db } = fastify;

  const fileService = resolveDependency(FileService);

  const appDataFileService = resolveDependency(AppDataFileService);

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
    actor: Member,
    repositories: Repositories,
    args: { appData: AppData },
  ) => {
    await appDataFileService.deleteOne(actor, repositories, args.appData);
  };
  appDataService.hooks.setPostHook('delete', deleteHook);

  // prevent patch on app data file
  const patchPreHook = async (
    _actor: Actor,
    _repositories: Repositories,
    args: { appData: Partial<AppData> },
  ) => {
    const { appData } = args;
    if (appData?.data && appData.data[fileService.fileType]) {
      throw new PreventUpdateAppDataFile(appData.id);
    }
  };
  appDataService.hooks.setPreHook('patch', patchPreHook);

  fastify.route<{ Querystring: IdParam; Body: unknown }>({
    method: HttpMethod.Post,
    url: '/app-data/upload',
    schema: upload,
    preHandler: guestAuthenticateAppsJWT,
    handler: async (request) => {
      const { user } = request;
      const member = notUndefined(user?.member);
      const app = notUndefined(user?.app);

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
          return appDataFileService.upload(member, repositories, file, app.item);
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
      const member = notUndefined(user?.member);
      const app = notUndefined(user?.app);

      return appDataFileService
        .download(member, buildRepositories(), { item: app.item, appDataId })
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
