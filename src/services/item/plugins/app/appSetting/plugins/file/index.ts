import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { HttpMethod, UUID } from '@graasp/sdk';

import { Repositories, buildRepositories } from '../../../../../../../util/repositories';
import { DEFAULT_MAX_FILE_SIZE } from '../../../../file/utils/constants';
import {
  DownloadFileUnexpectedError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
import type { AppSettingService } from '../../service';
import { download, upload } from './schema';
import AppSettingFileService from './service';

export interface GraaspPluginFileOptions {
  maxFileSize?: number; // max size for an uploaded file in bytes

  appSettingService: AppSettingService;
}

export const DEFAULT_MAX_STORAGE = 1024 * 1024 * 1024 * 1; // 1GB;

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE, appSettingService } = options;

  const {
    db,
    files: { service: fileService },
    items,
  } = fastify;

  const { service: itemService } = items;

  const appSettingFileService = new AppSettingFileService(
    appSettingService,
    fileService,
    itemService,
  );

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
  const deleteHook = async (actor, repositories, appSetting) => {
    await appSettingFileService.deleteOne(actor, repositories, appSetting);
  };
  appSettingService.hooks.setPostHook('delete', deleteHook);

  // app setting copy hook
  const hook = async (actor, repositories: Repositories, newAppSettings) => {
    // copy file only if content is a file
    const isFileSetting = (a) => a.data.type === fileService.type;
    const toCopy = newAppSettings.filter(isFileSetting);
    if (toCopy.length) {
      await appSettingFileService.copyMany(actor, repositories, toCopy);
    }
  };
  appSettingService.hooks.setPostHook('copyMany', hook);

  fastify.route<{ Body: any; Params: { itemId: UUID } }>({
    method: HttpMethod.POST,
    url: '/:itemId/app-settings/upload',
    schema: upload,
    handler: async (request) => {
      const {
        authTokenSubject: requestDetails,
        params: { itemId },
        log,
      } = request;
      const memberId = requestDetails?.memberId;
      // TODO: if one file fails, keep other files??? APPLY ROLLBACK
      // THEN WE SHOULD MOVE THE TRANSACTION
      return db
        .transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const files = await request.saveRequestFiles();
          return appSettingFileService.upload(memberId, repositories, files[0], itemId);
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
    Params: { itemId: UUID; id: UUID };
    Querystring: { size?: string; replyUrl?: boolean };
  }>(
    '/:itemId/app-settings/:id/download',
    {
      schema: download,
    },
    async (request, reply) => {
      const {
        authTokenSubject: requestDetails,
        params: { itemId, id: appSettingId },
        query: { size, replyUrl },
        log,
      } = request;

      const memberId = requestDetails?.memberId;

      return appSettingFileService
        .download(memberId, buildRepositories(), { reply, itemId, appSettingId, replyUrl })
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
