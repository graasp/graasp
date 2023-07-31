import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { FileItemProperties, HttpMethod, IdParam, PermissionLevel } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { mapById } from '../../../utils';
import { Item } from '../../entities/Item';
import { download, updateSchema, upload } from './schema';
import FileItemService from './service';
import { DEFAULT_MAX_FILE_SIZE, MAX_NUMBER_OF_FILES_UPLOAD } from './utils/constants';

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

  const { service: itemService, extendExtrasUpdateSchema } = items;

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

  // "install" custom schema for validating file items update
  extendExtrasUpdateSchema(updateSchema(fileService.type));

  const fileItemService = new FileItemService(
    fileService,
    items.service,
    items.thumbnails.service,
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
      if (!actor) {
        return;
      }
      try {
        // delete file only if type is the current file type
        if (!id || type !== fileService.type) return;
        const filepath = (extra[fileService.type] as FileItemProperties).path;
        await fileService.delete(actor, filepath);
      } catch (err) {
        // we catch the error, it ensures the item is deleted even if the file is not
        // this is especially useful for the files uploaded before the migration to the new plugin
        console.error(err);
      }
    },
  );

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPreHook('copy', async (actor, repositories, { original: item }) => {
    if (!actor) {
      return;
    }

    const { id, type } = item; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.type) return;
    const size = (item.extra[fileService.type] as FileItemProperties & { size?: number })?.size;

    await fileItemService.checkRemainingStorage(actor, repositories, size);
  });

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original, copy }) => {
    if (!actor) {
      return;
    }

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

      // check rights
      if (parentId) {
        const repositories = buildRepositories();
        const item = await repositories.itemRepository.get(parentId);
        await validatePermission(repositories, PermissionLevel.Write, member, item);
      }

      // upload file one by one
      // TODO: CHUNK FOR PERFORMANCE
      const files = request.files();
      const items: Item[] = [];
      const errors: Error[] = [];
      for await (const fileObject of files) {
        const { filename, mimetype, fields, file: stream } = fileObject;

        // if one file fails, keep other files
        // transaction to ensure item is saved with memberships
        await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          try {
            const i = await fileItemService.upload(member, repositories, {
              parentId,
              filename,
              mimetype,
              fields,
              stream,
            });
            items.push(i);
          } catch (e) {
            // ignore errors
            log.error(e);
            // force close to avoid hanging
            stream.emit('end');
            errors.push(e);
          }
        });
      }

      return {
        ...mapById({
          keys: items.map(({ id }) => id),
          findElement: (id) => items.find(({ id: thisId }) => id === thisId),
        }),
        // replace errors
        errors,
      };
    },
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

      return fileItemService.download(member, buildRepositories(), { reply, itemId, replyUrl });
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
