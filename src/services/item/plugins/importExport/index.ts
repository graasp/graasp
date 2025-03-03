import { StatusCodes } from 'http-status-codes';
import { default as sanitize } from 'sanitize-filename';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers, Context, ItemType, MAX_ZIP_FILE_SIZE } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { asDefined } from '../../../../utils/assertions';
import { ActionService } from '../../../action/action.service';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { matchOne } from '../../../authorization';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import { ZIP_FILE_MIME_TYPES } from './constants';
import { FileIsInvalidArchiveError } from './errors';
import { zipExport, zipImport } from './schema';
import { ImportExportService } from './service';
import { prepareZip } from './utils';

function encodeFilename(name: string) {
  return encodeURI(sanitize(name, { replacement: '_' }));
}

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const log = resolveDependency(BaseLogger);
  const itemService = resolveDependency(ItemService);
  const actionService = resolveDependency(ActionService);
  const importExportService = resolveDependency(ImportExportService);

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
      importExportService
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

  // download item
  fastify.get(
    '/:itemId/export',
    {
      schema: zipExport,
      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
      } = request;
      const member = user?.account;
      const item = await itemService.get(db, member, itemId);

      // trigger download action for a collection
      const action = {
        itemId: item.id,
        type: ActionTriggers.ItemDownload,
        extra: JSON.stringify({ itemId: item?.id }),
        // FIX: this should be infered from the request ! add a parameter in the request
        view: Context.Builder,
      };
      await actionService.postMany(db, member, request, [action]);

      // allow browser to access content disposition
      reply.header('Access-Control-Expose-Headers', 'Content-Disposition');

      // return single file
      if (item.type !== ItemType.FOLDER) {
        const { stream, mimetype, name } = await importExportService.fetchItemData(
          db,
          member,
          item,
        );

        reply.raw.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeFilename(name)}"`,
        );
        reply.type(mimetype);

        return stream;
      }

      // generate archive stream
      const archiveStream = await importExportService.export(
        db,
        member,
        {
          item,
          reply,
        },
        log,
      );

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
