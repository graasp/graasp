import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { ThumbnailSizeType } from '@graasp/sdk';

import { IdParam } from '../../../../types.js';
import { notUndefined } from '../../../../utils/assertions.js';
import { THUMBNAILS_ROUTE_PREFIX } from '../../../../utils/config.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport/index.js';
import { UploadFileUnexpectedError } from '../../../file/utils/errors.js';
import { DEFAULT_MAX_FILE_SIZE } from '../file/utils/constants.js';
import { deleteSchema, download, upload } from './schemas.js';
import { UploadFileNotImageError } from './utils/errors.js';

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
  maxFileSize?: number; // max size for an uploaded file in bytes
};

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;
  const {
    files: { service: fileService },
    items: {
      thumbnails: { service: thumbnailService },
    },
    db,
  } = fastify;

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      // fields: 5, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: maxFileSize, // For multipart forms, the max file size (Default: Infinity).
      files: 1, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  fastify.post<{ Params: IdParam }>(
    `/:id${THUMBNAILS_ROUTE_PREFIX}`,
    {
      schema: upload,
      preHandler: isAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        log,
      } = request;
      const member = notUndefined(user?.member);
      return db
        .transaction(async (manager) => {
          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const file = await request.file();

          // check file is an image
          if (!file || !file.mimetype.includes('image')) {
            throw new UploadFileNotImageError();
          }

          await thumbnailService.upload(member, buildRepositories(manager), itemId, file.file);

          reply.status(StatusCodes.NO_CONTENT);
        })
        .catch((e) => {
          log.error(e);

          if (e.code) {
            throw e;
          }
          throw new UploadFileUnexpectedError(e);
        });
    },
  );

  fastify.get<{
    Params: IdParam & { size: ThumbnailSizeType };
    Querystring: { replyUrl?: boolean };
  }>(
    `/:id${THUMBNAILS_ROUTE_PREFIX}/:size`,
    {
      schema: download,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { size, id: itemId }, query: { replyUrl } }, reply) => {
      const url = await thumbnailService.getUrl(user?.member, buildRepositories(), {
        itemId,
        size,
      });

      fileService.setHeaders({ reply, replyUrl, url, id: itemId });
    },
  );

  fastify.delete<{ Params: IdParam }>(
    `/:id${THUMBNAILS_ROUTE_PREFIX}`,
    { schema: deleteSchema, preHandler: isAuthenticated },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
      } = request;
      const member = notUndefined(user?.member);
      await thumbnailService.deleteAllThumbnailSizes(member, buildRepositories(), {
        itemId,
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
