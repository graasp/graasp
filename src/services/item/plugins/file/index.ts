import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { FileItemProperties, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne, validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { assertIsMember, isMember } from '../../../member/entities/member';
import { StorageService } from '../../../member/plugins/storage/service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { download, upload } from './schema';
import FileItemService from './service';
import { DEFAULT_MAX_FILE_SIZE, MAX_NUMBER_OF_FILES_UPLOAD } from './utils/constants';

export interface GraaspPluginFileOptions {
  uploadMaxFileNb?: number; // max number of files to upload at a time
  maxFileSize?: number; // max size for an uploaded file in bytes
  maxMemberStorage?: number; // max storage space for a user
}

const basePlugin: FastifyPluginAsyncTypebox<GraaspPluginFileOptions> = async (fastify, options) => {
  const { uploadMaxFileNb = MAX_NUMBER_OF_FILES_UPLOAD, maxFileSize = DEFAULT_MAX_FILE_SIZE } =
    options;

  const { db } = fastify;

  const fileService = resolveDependency(FileService);
  const itemService = resolveDependency(ItemService);
  const storageService = resolveDependency(StorageService);
  const fileItemService = resolveDependency(FileItemService);

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

  // register post delete handler to remove the file object after item delete
  itemService.hooks.setPostHook(
    'delete',
    async (actor, repositories, { item: { id, type, extra } }) => {
      if (!actor) {
        return;
      }
      try {
        // delete file only if type is the current file type
        if (!id || type !== fileService.fileType) {
          return;
        }
        const filepath = (extra[fileService.fileType] as FileItemProperties).path;
        await fileService.delete(filepath);
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
    assertIsMember(actor);

    const { id, type } = item; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.fileType) return;
    const size = (item.extra[fileService.fileType] as FileItemProperties & { size?: number })?.size;

    await storageService.checkRemainingStorage(actor, repositories, size);
  });

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original, copy }) => {
    if (!actor || !isMember(actor)) {
      return;
    }

    const { id, type } = copy; // full copy with new `id`

    // copy file only if type is the current file type
    if (!id || type !== fileService.fileType) {
      return;
    }
    await fileItemService.copy(actor, repositories, { original, copy });
  });

  fastify.post('/upload', {
    schema: upload,
    preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    handler: async (request) => {
      const {
        user,
        query: { id: parentId, previousItemId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      // check rights
      if (parentId) {
        const repositories = buildRepositories();
        const item = await repositories.itemRepository.getOneOrThrow(parentId);
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
            // if the file is an H5P file, we treat it appropriately
            // othwerwise, we save it as a generic file
            const item = await fileItemService.upload(member, repositories, {
              parentId,
              filename,
              mimetype,
              stream,
              previousItemId,
            });

            items.push(item);
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

      // rescale is necessary when uploading multiple files: they have the same order number
      if (items.length) {
        await itemService.rescaleOrderForParent(member, buildRepositories(), items[0]);
      }

      return {
        data: items.reduce((data, item) => ({ ...data, [item.id]: item }), {}),
        errors,
      };
    },
  });

  fastify.get(
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

      const url = await fileItemService.getUrl(user?.account, buildRepositories(), {
        itemId,
      });
      fileService.setHeaders({ url, reply, replyUrl, id: itemId });
    },
  );
};

export default basePlugin;
