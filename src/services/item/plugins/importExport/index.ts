import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../util/repositories';
import { DEFAULT_MAX_FILE_SIZE } from '../file/utils/constants';
import { zipExport, zipImport } from './schema';
import { ImportExportService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    // h5p: { service: h5pS },
    items: {
      service: iS,
      files: { service: fS },
    },
  } = fastify;

  const importExportService = new ImportExportService(fS, iS);

  fastify.register(fastifyMultipart, {
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
    { schema: zipImport },
    async (request, reply) => {
      const {
        member,
        log,
        query: { parentId },
      } = request;

      log.debug('Import zip content');

      const zipFile = await request.file();

      // create items from folder
      // does not wait
      importExportService.import(member, buildRepositories(), {
        zipFile,
        parentId,
      });

      reply.status(StatusCodes.ACCEPTED);
    },
  );

  // download item as zip
  fastify.route<{ Params: { itemId: string } }>({
    method: 'GET',
    url: '/zip-export/:itemId',
    schema: zipExport,
    handler: async ({ member, params: { itemId } }, reply) => {
      // do not wait
      importExportService.export(member, buildRepositories(), {
        itemId,
        reply,
      });

      reply.status(StatusCodes.ACCEPTED);
    },
  });
};

export default plugin;
