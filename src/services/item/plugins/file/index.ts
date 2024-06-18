import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { FileItemProperties, HttpMethod, PermissionLevel } from '@graasp/sdk';

import { IdParam } from '../../../../types.js';
import { notUndefined } from '../../../../utils/assertions.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport/index.js';
import { validatePermission } from '../../../authorization.js';
import { Item } from '../../entities/Item.js';
import { download, updateSchema, upload } from './schema.js';
import FileItemService from './service.js';
import { DEFAULT_MAX_FILE_SIZE, MAX_NUMBER_OF_FILES_UPLOAD } from './utils/constants.js';

export interface GraaspPluginFileOptions {
  shouldRedirectOnDownload?: boolean; // redirect value on download
  uploadMaxFileNb?: number; // max number of files to upload at a time
  maxFileSize?: number; // max size for an uploaded file in bytes
  maxMemberStorage?: number; // max storage space for a user
}

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const {
    uploadMaxFileNb = MAX_NUMBER_OF_FILES_UPLOAD,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    shouldRedirectOnDownload = true,
  } = options;

  const {
    db,
    files: { service: fileService },
    items,
    storage: { service: storageService },
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
    storageService,
    items.thumbnails.service,
    shouldRedirectOnDownload,
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

    await storageService.checkRemainingStorage(actor, repositories, size);
  });

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original, copy }) => {
    if (!actor) {
      return;
    }

    const { id, type } = copy; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.type) {
      return;
    }
    await fileItemService.copy(actor, repositories, { original, copy });
  });

  fastify.route<{ Querystring: IdParam; Body: unknown }>({
    method: HttpMethod.Post,
    url: '/upload',
    schema: upload,
    preHandler: isAuthenticated,
    handler: async (request) => {
      const {
        user,
        query: { id: parentId },
        log,
      } = request;
      const member = notUndefined(user?.member);
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
        const { filename, mimetype, file: stream } = fileObject;

        // if one file fails, keep other files
        // transaction to ensure item is saved with memberships
        await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          try {
            const i = await fileItemService.upload(member, repositories, {
              parentId,
              filename,
              mimetype,
              stream,
            });
            items.push(i);
          } catch (e) {
            // ignore errors
            log.error(e);
            errors.push(e);
          } finally {
            // force close to avoid hanging
            // necessary for errors that don't read the stream
            stream.emit('end');
          }
        });
      }

      return {
        data: items.reduce((data, item) => ({ ...data, [item.id]: item }), {}),
        errors,
      };
    },
  });

  fastify.get<{ Params: IdParam; Querystring: { replyUrl?: boolean } }>(
    '/:id/download',
    {
      schema: download,

      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        query: { replyUrl },
      } = request;

      const url = await fileItemService.getUrl(user?.member, buildRepositories(), {
        itemId,
      });
      fileService.setHeaders({ url, reply, replyUrl, id: itemId });
    },
  );
};

export default basePlugin;
