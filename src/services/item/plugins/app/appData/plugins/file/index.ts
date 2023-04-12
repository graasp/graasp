import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { HttpMethod, IdParam, UUID } from '@graasp/sdk';

import { buildRepositories } from '../../../../../../../util/repositories';
import {
  DownloadFileUnexpectedError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
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
  const deleteHook = async (actor, repositories, appData) => {
    await appDataFileService.deleteOne(actor, repositories, appData);
  };
  appDataService.hooks.setPostHook('delete', deleteHook);

  fastify.route<{ Querystring: IdParam; Body: any }>({
    method: HttpMethod.POST,
    url: '/:itemId/app-data/upload',
    schema: upload,
    handler: async (request) => {
      const {
        member,
        query: { id: itemId },
        log,
      } = request;
      // TODO: if one file fails, keep other files??? APPLY ROLLBACK
      // THEN WE SHOULD MOVE THE TRANSACTION
      return db
        .transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const files = await request.saveRequestFiles();
          return appDataFileService.upload(member, repositories, files[0], itemId);
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
    '/:itemId/app-data/:id/download',
    {
      schema: download,
    },
    async (request, reply) => {
      const {
        member,
        authTokenSubject,
        params: { id: appDataId, itemId },
        query: { size, replyUrl },
        log,
      } = request;

      // need auth token?
      const actor = member || { id: authTokenSubject?.memberId };

      return appDataFileService
        .download(actor, buildRepositories(), { reply, itemId, appDataId, replyUrl })
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
