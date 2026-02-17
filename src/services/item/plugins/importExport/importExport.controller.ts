import { Queue } from 'bullmq';
import { StatusCodes } from 'http-status-codes';
import { default as sanitize } from 'sanitize-filename';

import { fastifyMultipart } from '@fastify/multipart';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers, Context, MAX_ZIP_FILE_SIZE } from '@graasp/sdk';

import { REDIS_CONNECTION } from '../../../../config/redis';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { asDefined, assertIsDefined } from '../../../../utils/assertions';
import { Queues } from '../../../../workers/config';
import { ActionService } from '../../../action/action.service';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { WrongItemTypeError } from '../../errors';
import { isFolderItem } from '../../item';
import { ZIP_FILE_MIME_TYPES } from './constants';
import { FileIsInvalidArchiveError } from './errors';
import { GraaspExportService } from './graaspExport.service';
import { ImportService } from './import.service';
import { downloadFile, exportZip, graaspZipExport, zipImport } from './importExport.schemas';
import { ItemExportService } from './itemExport.service';
import { prepareZip } from './utils';

function encodeFilename(name: string) {
  return encodeURI(sanitize(name, { replacement: '_' }));
}

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const log = resolveDependency(BaseLogger);
  const authorizedItemService = resolveDependency(AuthorizedItemService);
  const actionService = resolveDependency(ActionService);
  const importService = resolveDependency(ImportService);
  const itemExportService = resolveDependency(ItemExportService);
  const graaspExportService = resolveDependency(GraaspExportService);

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 0, // Max number of non-file fields (Default: Infinity).
      fileSize: MAX_ZIP_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
      files: 1, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  fastify.post(
    '/zip-import',
    {
      schema: zipImport,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        log,
        query: { parentId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      log.debug('Import zip content');

      const zipFile = await request.file();

      if (!zipFile) {
        throw new Error('Zip file is undefined');
      }

      // throw if file is not a zip
      if (!ZIP_FILE_MIME_TYPES.includes(zipFile.mimetype)) {
        throw new FileIsInvalidArchiveError(zipFile.mimetype);
      }

      // prepare zip before replying to keep the file stream open
      const { folderPath, targetFolder } = await prepareZip(zipFile.file, log);

      // create items from folder
      // does not wait
      importService
        .import(db, member, {
          folderPath,
          targetFolder,
          parentId,
        })
        .catch((e) => {
          log.error(e);
        });

      reply.status(StatusCodes.ACCEPTED);
    },
  );

  // export non-folder item as raw file
  fastify.get(
    '/:itemId/download-file',
    {
      schema: downloadFile,
      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
      } = request;
      const maybeUser = user?.account;
      const item = await authorizedItemService.getItemById(db, {
        accountId: maybeUser?.id,
        itemId,
      });

      // do not allow folders
      if (isFolderItem(item)) {
        throw new WrongItemTypeError(item.type);
      }

      // trigger download action for a collection
      const action = {
        itemId: item.id,
        type: ActionTriggers.ItemDownload,
        extra: JSON.stringify({ itemId: item?.id }),
        // FIXME: this should be infered from the request ! add a parameter in the request
        view: Context.Builder,
      };
      await actionService.postMany(db, maybeUser, request, [action]);

      // return single file
      const { stream, mimetype, name } = await itemExportService.fetchItemData(db, maybeUser, item);
      // allow browser to access content disposition
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');
      reply.raw.setHeader('Content-Disposition', `attachment; filename="${encodeFilename(name)}"`);
      reply.type(mimetype);

      return stream;
    },
  );

  // export folder as a zip containing raw files
  fastify.post(
    '/:itemId/export',
    {
      schema: exportZip,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = user?.account;
      assertIsDefined(member);
      assertIsMember(member);
      const item = await authorizedItemService.getItemById(db, {
        accountId: member.id,
        itemId,
      });

      // only allow folders
      if (item.type !== 'folder') {
        throw new WrongItemTypeError(item.type);
      }

      // add task in queue
      const queue = new Queue(Queues.ItemExport.queueName, {
        connection: { url: REDIS_CONNECTION },
      });
      await queue.add(Queues.ItemExport.jobs.exportFolderZip, {
        itemId: item.id,
        memberId: member.id,
      });

      // will generate archive in the background
      reply.status(StatusCodes.ACCEPTED).send({ message: 'Export started' });
    },
  );

  // export item in graasp format
  fastify.post(
    '/:itemId/graasp-export',
    {
      schema: graaspZipExport,
      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
      } = request;
      const maybeUser = user?.account;
      const item = await authorizedItemService.getItemById(db, {
        accountId: maybeUser?.id,
        itemId,
      });

      // allow browser to access content disposition
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');

      // generate archive stream
      const archiveStream = await graaspExportService.exportGraasp(db, maybeUser, item);

      try {
        reply.raw.setHeader('Content-Disposition', `filename="${encodeFilename(item.name)}.zip"`);
      } catch (e) {
        // TODO: send sentry error
        log?.error(e);
        reply.raw.setHeader('Content-Disposition', 'filename="download.zip"');
      }
      reply.type('application/octet-stream');
      return archiveStream.outputStream;
    },
  );
};

export default plugin;
