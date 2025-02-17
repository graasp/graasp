import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { THUMBNAILS_ROUTE_PREFIX } from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { UploadFileUnexpectedError } from '../../../file/utils/errors';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { DEFAULT_MAX_FILE_SIZE } from '../file/utils/constants';
import { deleteSchema, download, upload } from './schemas';
import { ItemThumbnailService } from './service';
import { UploadFileNotImageError } from './utils/errors';

type GraaspThumbnailsOptions = {
  shouldRedirectOnDownload?: boolean;
  maxFileSize?: number; // max size for an uploaded file in bytes
};

const plugin: FastifyPluginAsyncTypebox<GraaspThumbnailsOptions> = async (fastify, options) => {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;
  const { db } = fastify;

  const itemThumbnailService = resolveDependency(ItemThumbnailService);

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
    `/:id${THUMBNAILS_ROUTE_PREFIX}`,
    {
      schema: upload,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
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

          await itemThumbnailService.upload(member, buildRepositories(manager), itemId, file.file);

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

  fastify.get(
    `/:id${THUMBNAILS_ROUTE_PREFIX}/:size`,
    {
      schema: download,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { size, id: itemId } }, reply) => {
      const url = await itemThumbnailService.getUrl(user?.account, buildRepositories(), {
        itemId,
        size,
      });

      if (!url) {
        return null;
      } else {
        reply.status(StatusCodes.OK).send(url);
      }
    },
  );

  fastify.delete(
    `/:id${THUMBNAILS_ROUTE_PREFIX}`,
    { schema: deleteSchema, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      await itemThumbnailService.deleteAllThumbnailSizes(member, buildRepositories(), {
        itemId,
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
