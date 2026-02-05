import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { type FileItemProperties, getFileExtension } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { asDefined, assertIsDefined } from '../../../../utils/assertions';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport';
import { assertIsMember, isMember } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import FileService from '../../../file/file.service';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../item.service';
import { H5PService } from '../html/h5p/h5p.service';
import { H5P_FILE_EXTENSION } from '../importExport/constants';
import { getUrl, updateFile, upload } from './itemFile.schema';
import FileItemService from './itemFile.service';
import {
  DEFAULT_MAX_FILE_SIZE,
  MAX_NUMBER_OF_FILES_UPLOAD,
} from './utils/constants';

const basePlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const fileService = resolveDependency(FileService);
  const itemService = resolveDependency(ItemService);
  const storageService = resolveDependency(StorageService);
  const fileItemService = resolveDependency(FileItemService);
  const h5pService = resolveDependency(H5PService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 0, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: DEFAULT_MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
      files: MAX_NUMBER_OF_FILES_UPLOAD, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  // register post delete handler to remove the file object after item delete
  itemService.hooks.setPostHook(
    'delete',
    async (actor, db, { item: { id, type, extra } }) => {
      if (!actor) {
        return;
      }
      try {
        // delete file only if type is the current file type
        if (!id || type !== 'file') {
          return;
        }
        const filepath = (extra['file'] as FileItemProperties).path;
        await fileService.delete(filepath);
      } catch (err) {
        // we catch the error, it ensures the item is deleted even if the file is not
        // this is especially useful for the files uploaded before the migration to the new plugin
        console.error(err);
      }
    },
  );

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPreHook(
    'copy',
    async (actor, thisDb, { original: item }) => {
      if (!actor) {
        return;
      }
      assertIsMember(actor);

      const { id, type } = item; // full copy with new `id`

      // copy file only if type is the current file type
      if (!id || type !== 'file') return;
      const size = (
        item.extra['file'] as FileItemProperties & { size?: number }
      )?.size;

      await storageService.checkRemainingStorage(thisDb, actor, size);
    },
  );

  // register post copy handler to copy the file object after item copy
  itemService.hooks.setPostHook(
    'copy',
    async (actor, thisDb, { original, copy }) => {
      if (!actor || !isMember(actor)) {
        return;
      }

      const { id, type } = copy; // full copy with new `id`

      // copy file only if type is the current file type
      if (!id || type !== 'file') {
        return;
      }
      await fileItemService.copyFile(thisDb, actor, { original, copy });
    },
  );

  fastify.post('/upload', {
    schema: upload,
    preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    handler: async (request, reply) => {
      const {
        user,
        query: { id: parentId, previousItemId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      // check rights
      if (parentId) {
        await authorizedItemService.assertAccessForItemId(db, {
          permission: 'write',
          accountId: member.id,
          itemId: parentId,
        });
      }

      // upload file one by one
      // TODO: CHUNK FOR PERFORMANCE
      const files = request.files();
      const items: ItemRaw[] = [];
      const errors: Error[] = [];

      for await (const fileObject of files) {
        const { filename, mimetype, file: stream } = fileObject;

        // if one file fails, keep other files
        // transaction to ensure item is saved with memberships
        await db.transaction(async (tx) => {
          try {
            // if the file is an H5P file, we treat it appropriately
            // othwerwise, we save it as a generic file
            let item: ItemRaw;
            if (getFileExtension(filename) === H5P_FILE_EXTENSION) {
              item = await h5pService.uploadFileAndCreateItem(
                tx,
                member,
                filename,
                stream,
                parentId,
                previousItemId,
                log,
              );
            } else {
              item = await fileItemService.uploadFileAndCreateItem(tx, member, {
                parentId,
                filename,
                mimetype,
                stream,
                previousItemId,
              });
            }

            items.push(item);
          } catch (e) {
            // ignore errors
            log.error(e);
            errors.push(e);
          } finally {
            // force close to avoid hanging
            // necessary for errors that don't read the stream
            log.debug('close file stream');
            stream.emit('end');
          }
        });
      }

      // rescale is necessary when uploading multiple files: they have the same order number
      if (items.length) {
        await itemService.rescaleOrderForParent(db, member, items[0]);
      }

      // return first error only
      if (errors.length) {
        throw errors[0];
      }

      reply
        .status(StatusCodes.NO_CONTENT)
        .send({ message: 'Processing file upload' });
    },
  });

  fastify.get(
    '/:id/download',
    {
      schema: getUrl,
      preHandler: optionalIsAuthenticated,
    },
    async (request) => {
      const {
        user,
        params: { id: itemId },
      } = request;

      const url = await fileItemService.getUrl(db, user?.account, {
        itemId,
      });

      return url;
    },
  );

  fastify.patch(
    '/files/:id',
    {
      schema: updateFile,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId }, body }, reply) => {
      const member = user?.account;
      assertIsDefined(member);
      assertIsMember(member);

      await db.transaction(async (tx) => {
        await fileItemService.update(tx, member, itemId, body);
      });

      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default basePlugin;
