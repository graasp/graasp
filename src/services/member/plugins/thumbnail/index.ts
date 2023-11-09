import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, ThumbnailSizeType } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { DEFAULT_MAX_FILE_SIZE } from '../../../file/utils/constants';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../file/utils/errors';
import { download, upload } from './schemas';
import { MemberThumbnailService } from './service';
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
    members: { service: memberService },
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

  const thumbnailService = new MemberThumbnailService(memberService, fileService);

  fastify.post<{ Params: IdParam }>(
    '/avatar',
    {
      schema: upload,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const { member, log } = request;

      if (!member) {
        throw new UnauthorizedMember(member);
      }

      return db
        .transaction(async (manager) => {
          // const files = request.files();
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          const file = await request.file();
          if (!file) {
            throw new UploadEmptyFileError();
          }
          // check file is an image
          if (!file.mimetype.includes('image')) {
            throw new UploadFileNotImageError();
          }

          await thumbnailService.upload(member, buildRepositories(manager), file.file);

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
    '/:id/avatar/:size',
    {
      schema: download,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { size, id: memberId }, query: { replyUrl }, log }, reply) => {
      const url = await thumbnailService
        .getUrl(member, buildRepositories(), { memberId, size })
        .catch((e) => {
          if (e.code) {
            throw e;
          }
          throw new DownloadFileUnexpectedError(e);
        });
      fileService.setHeaders({ reply, replyUrl, url, id: memberId });
    },
  );
};

export default plugin;
