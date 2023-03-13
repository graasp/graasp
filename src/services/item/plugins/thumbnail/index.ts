import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam } from '@graasp/sdk';

import { THUMBNAILS_ROUTE_PREFIX } from '../../../../util/config';
import { buildRepositories } from '../../../../util/repositories';
import { DownloadFileUnexpectedError, UploadFileUnexpectedError } from '../file/utils/errors';
import { upload } from './schemas';
import { ThumbnailService } from './service';
import { ThumbnailSize } from './utils/constants';
import { UploadFileNotImageError } from './utils/errors';

export const SMALL = 'small';
export const MEDIUM = 'medium';
export const LARGE = 'large';
export const ORIGINAL = 'original';

export const THUMBNAIL_SIZES = [SMALL, MEDIUM, LARGE, ORIGINAL];

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
};

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { shouldRedirectOnDownload = true } = options;
  const {
    log: defaultLogger,
    files: { service: fileService },
    items: { service: itemService },
    db,
  } = fastify;

  const thumbnailService = new ThumbnailService(fileService, shouldRedirectOnDownload);

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

      return db
        .transaction(async (manager) => {
          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const [file] = await request.saveRequestFiles();

          // check file is an image
          if (!file.mimetype.includes('image')) {
            throw new UploadFileNotImageError();
          }
          const repositories = buildRepositories(manager);

          const item = await thumbnailService.upload(member, repositories, itemId, file);

          // update item that should have thumbnail
          await itemService.patch(member, repositories, itemId, {
            settings: { hasThumbnail: true  },
          });

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

  fastify.get<{ Params: IdParam & { size: ThumbnailSize }; Querystring: { replyUrl?: boolean } }>(
    `/:id${THUMBNAILS_ROUTE_PREFIX}/:size`,
    {
      // schema: download,

      preHandler: fastify.fetchMemberInSession,
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
