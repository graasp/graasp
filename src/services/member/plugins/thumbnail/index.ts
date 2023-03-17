import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam } from '@graasp/sdk';

import { buildRepositories } from '../../../../util/repositories';
import {
  DownloadFileUnexpectedError,
  UploadFileUnexpectedError,
} from '../../../item/plugins/file/utils/errors';
import { upload } from './schemas';
import { MemberThumbnailService } from './service';
import { UploadFileNotImageError } from './utils/errors';

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
};

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { shouldRedirectOnDownload = true } = options;
  const {
    log: defaultLogger,
    files: { service: fileService },
    members: { service: memberService },
    db,
  } = fastify;

  const thumbnailService = new MemberThumbnailService(
    memberService,
    fileService,
    shouldRedirectOnDownload,
  );

  fastify.post<{ Params: IdParam }>(
    '/avatar',
    {
      schema: upload,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const { member, log } = request;

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

          await thumbnailService.upload(member, buildRepositories(manager), file);

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

  // TODO: use ThumbnailSizeVariant
  fastify.get<{ Params: IdParam & { size: string }; Querystring: { replyUrl?: boolean } }>(
    '/:id/avatar/:size',
    {
      // schema: download,
      preHandler: fastify.fetchMemberInSession,
    },
    async ({ member, params: { size, id: memberId }, query: { replyUrl }, log }, reply) => {
      return thumbnailService
        .download(member, buildRepositories(), { reply, memberId, replyUrl, size })
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
