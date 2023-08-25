import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, ThumbnailSizeType } from '@graasp/sdk';

import { THUMBNAILS_ROUTE_PREFIX } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { DownloadFileUnexpectedError, UploadFileUnexpectedError } from '../../../file/utils/errors';
import { DEFAULT_MAX_FILE_SIZE } from '../file/utils/constants';
import { download, upload } from './schemas';
import { ItemThumbnailService } from './service';
import { UploadFileNotImageError } from './utils/errors';

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
  maxFileSize?: number; // max size for an uploaded file in bytes
};

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;
  const {
    log: defaultLogger,
    files: { service: fileService },
    items,
    db,
  } = fastify;

  const { service: itemService } = items;

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

  const thumbnailService = new ItemThumbnailService(itemService, fileService);

  // decorate thumbnail service
  items.thumbnails = { service: thumbnailService };

  fastify.post<{ Params: IdParam }>(
    `/:id${THUMBNAILS_ROUTE_PREFIX}`,
    {
      schema: upload,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        params: { id: itemId },
        log,
      } = request;

      if (!member) {
        throw new UnauthorizedMember(member);
      }

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
          console.error(e);

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
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { size, id: itemId }, query: { replyUrl }, log }, reply) => {
      return thumbnailService
        .download(member, buildRepositories(), { reply, itemId, replyUrl, size })
        .catch((e) => {
          if (e.code) {
            throw e;
          }
          throw new DownloadFileUnexpectedError(e);
        });
    },
  );
};

export default plugin;
