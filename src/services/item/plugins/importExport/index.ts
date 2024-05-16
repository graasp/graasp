import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { ActionTriggers } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { DEFAULT_MAX_FILE_SIZE } from '../file/utils/constants';
import { ZIP_FILE_MIME_TYPES } from './constants';
import { FileIsInvalidArchiveError } from './errors';
import { zipExport, zipImport } from './schema';
import { ImportExportService } from './service';
import { prepareZip } from './utils';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: {
      service: iS,
      files: { service: fS },
    },
    actions: { service: aS },
    h5p: { service: h5pService },
    log: fastifyLogger,
    db,
  } = fastify;

  const importExportService = new ImportExportService(db, fS, iS, h5pService, fastifyLogger);

  await fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 0, // Max number of non-file fields (Default: Infinity).
      fileSize: DEFAULT_MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
      files: 1, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  fastify.post<{ Querystring: { parentId?: string } }>(
    '/zip-import',
    { schema: zipImport, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        log,
        query: { parentId },
      } = request;

      if (!member) {
        throw new UnauthorizedMember(member);
      }

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
        .import(
          member,
          buildRepositories(),
          {
            folderPath,
            targetFolder,
            parentId,
          },
          log,
        )
        .catch((e) => {
          log.error(e);
        });

      void reply.status(StatusCodes.ACCEPTED);
    },
  );

  // download item as zip
  fastify.route<{ Params: { itemId: string } }>({
    method: 'GET',
    url: '/zip-export/:itemId',
    schema: zipExport,
    preHandler: fastify.attemptVerifyAuthentication,
    handler: async (request, reply) => {
      const {
        member,
        params: { itemId },
        log,
      } = request;
      const repositories = buildRepositories();
      const item = await iS.get(member, repositories, itemId);

      // generate archive stream
      const archiveStream = await importExportService.export(member, repositories, {
        item,
        reply,
      });

      // trigger download action for a collection
      const action = {
        item,
        type: ActionTriggers.ItemDownload,
        extra: { itemId: item?.id },
      };
      await aS.postMany(member, repositories, request, [action]);

      try {
        reply.raw.setHeader(
          'Content-Disposition',
          `filename="${encodeURIComponent(item.name)}.zip"`,
        );
      } catch (e) {
        // TODO: send sentry error
        log?.error(e);
        reply.raw.setHeader('Content-Disposition', 'filename="download.zip"');
      }
      void reply.type('application/octet-stream');
      return archiveStream.outputStream;
    },
  });
};

export default plugin;
