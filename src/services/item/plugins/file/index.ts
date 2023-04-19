import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { FileProperties, HttpMethod, IdParam } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { download, upload } from './schema';
import FileItemService from './service';
import { DEFAULT_MAX_FILE_SIZE, MAX_NUMBER_OF_FILES_UPLOAD } from './utils/constants';
import { DownloadFileUnexpectedError, UploadFileUnexpectedError } from './utils/errors';

export interface GraaspPluginFileOptions {
  shouldRedirectOnDownload?: boolean; // redirect value on download
  uploadMaxFileNb?: number; // max number of files to upload at a time
  maxFileSize?: number; // max size for an uploaded file in bytes
  maxMemberStorage?: number; // max storage space for a user
}

export const DEFAULT_MAX_STORAGE = 1024 * 1024 * 1024 * 5; // 5GB;

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const {
    uploadMaxFileNb = MAX_NUMBER_OF_FILES_UPLOAD,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    shouldRedirectOnDownload = true,
    maxMemberStorage = DEFAULT_MAX_STORAGE,
  } = options;

  const {
    db,
    files: { service: fileService },
    items,
  } = fastify;

  const { service: itemService } = items;

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 0, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: maxFileSize, // For multipart forms, the max file size (Default: Infinity).
      files: uploadMaxFileNb, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  // if (!buildFilePath) {
  //   throw new Error('graasp-plugin-file: buildFilePath is not defined');
  // }

  const fileItemService = new FileItemService(
    fileService,
    items.service,
    shouldRedirectOnDownload,
    {
      maxMemberStorage,
    },
  );
  items.files = { service: fileItemService };

  // register post delete handler to remove the file object after item delete
  itemService.hooks.setPostHook(
    'delete',
    async (actor, repositories, { item: { id, type, extra } }) => {
      try {
        // delete file only if type is the current file type
        if (!id || type !== fileService.type) return;
        const filepath = extra[fileService.type].path;
        await fileService.delete(actor, { filepath });
      } catch (err) {
        // we catch the error, it ensures the item is deleted even if the file is not
        // this is especially useful for the files uploaded before the migration to the new plugin
        console.error(err);
      }
    },
  );

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPreHook('copy', async (actor, repositories, { item }) => {
    const { id, type } = item; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.type) return;
    const size = (item.extra[fileService.type] as FileProperties & { size?: number })?.size;

    await fileItemService.checkRemainingStorage(actor, repositories, size);
  });

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original, copy }) => {
    const { id, type } = copy; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.type) return;
    await fileItemService.copy(actor, repositories, { original, copy });
  });

  fastify.route<{ Querystring: IdParam; Body: any }>({
    method: HttpMethod.POST,
    url: '/upload',
    schema: upload,
    preHandler: fastify.verifyAuthentication,
    handler: async (request) => {
      const {
        member,
        query: { id: parentId },
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
          return fileItemService.upload(member, repositories, files, parentId);
        })
        // .catch((e) => {
        //   console.error(e);

        //   // TODO rollback uploaded file

        //   if (e.code) {
        //     throw e;
        //   }
        //   throw new UploadFileUnexpectedError(e);
        // });
    },
    // onResponse: async (request, reply) => {
    //   uploadOnResponse?.(request, reply);
    // },
  });

  fastify.get<{ Params: IdParam; Querystring: { size?: string; replyUrl?: boolean } }>(
    '/:id/download',
    {
      schema: download,

      preHandler: fastify.fetchMemberInSession,
    },
    async (request, reply) => {
      const {
        member,
        params: { id: itemId },
        query: { size, replyUrl },
        log,
      } = request;

      return fileItemService
        .download(member, buildRepositories(), { reply, itemId, replyUrl })
        // .catch((e) => {
        //   if (e.code) {
        //     throw e;
        //   }
        //   throw new DownloadFileUnexpectedError(e);
        // });
    },
  );
};

export default basePlugin;
