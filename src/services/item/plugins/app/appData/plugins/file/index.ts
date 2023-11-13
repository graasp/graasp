import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { HttpMethod, IdParam, UUID } from '@graasp/sdk';

import { Repositories, buildRepositories } from '../../../../../../../utils/repositories';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../../../file/utils/errors';
import { Actor, Member } from '../../../../../../member/entities/member';
import { AppData } from '../../appData';
import { PreventUpdateAppDataFile } from '../../errors';
import type { AppDataService } from '../../service';
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

  const {
    db,
    files: { service: fileService },
    items,
  } = fastify;

  const { service: itemService } = items;

  const appDataFileService = new AppDataFileService(appDataService, fileService, itemService);

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
    actor: Actor,
    repositories: Repositories,
    args: { appData: Partial<AppData> },
  ) => {
    const { appData } = args;
    if (appData?.data && appData.data[fileService.type]) {
      throw new PreventUpdateAppDataFile(appData.id);
    }
  };
  appDataService.hooks.setPreHook('patch', patchPreHook);

  fastify.route<{ Querystring: IdParam; Body: any }>({
    method: HttpMethod.POST,
    url: '/app-data/upload',
    schema: upload,
    handler: async (request) => {
      const { authTokenSubject: requestDetails, log } = request;
      const memberId = requestDetails?.memberId;
      const itemId = requestDetails?.itemId;

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
          return appDataFileService.upload(memberId, repositories, file, itemId);
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
    },
    async (request) => {
      const {
        authTokenSubject: requestDetails,
        params: { id: appDataId },
      } = request;
      const memberId = requestDetails?.memberId;
      const itemId = requestDetails?.itemId;

      return appDataFileService
        .download(memberId, buildRepositories(), { itemId, appDataId })
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
