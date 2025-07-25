import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { MAX_THUMBNAIL_SIZE } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { UploadEmptyFileError, UploadFileUnexpectedError } from '../../../file/utils/errors';
import { validatedMemberAccountRole } from '../../strategies/validatedMemberAccountRole';
import { download, upload } from './memberThumbnail.schemas';
import { MemberThumbnailService } from './memberThumbnail.service';
import { UploadFileNotImageError } from './utils/errors';

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
  maxFileSize?: number; // max size for an uploaded file in bytes
};

const plugin: FastifyPluginAsyncTypebox<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { maxFileSize = MAX_THUMBNAIL_SIZE } = options;
  const thumbnailService = resolveDependency(MemberThumbnailService);

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

  fastify.post(
    '/avatar',
    {
      schema: upload,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const member = asDefined(request.user?.account);
      assertIsMember(member);
      return db
        .transaction(async (tx) => {
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

          await thumbnailService.upload(tx, member, file.file);

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

  fastify.get(
    '/:id/avatar/:size',
    {
      schema: download,
      preHandler: optionalIsAuthenticated,
    },
    async ({ params: { size, id: memberId } }, reply) => {
      const url = await thumbnailService.getUrl(db, {
        memberId,
        size,
      });

      if (!url) {
        reply.status(StatusCodes.NO_CONTENT);
      } else {
        reply.status(StatusCodes.OK).send(url);
      }
    },
  );
};

export default plugin;
