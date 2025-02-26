import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { HttpMethod } from '@graasp/sdk';

import { resolveDependency } from '../../../../../../../di/utils';
import { DBConnection, db } from '../../../../../../../drizzle/db';
import { asDefined } from '../../../../../../../utils/assertions';
import { guestAuthenticateAppsJWT } from '../../../../../../auth/plugins/passport';
import {
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../../../file/utils/errors';
import { Member } from '../../../../../../member/entities/member';
import { addMemberInAppData } from '../../../legacy';
import { AppData } from '../../appData';
import { AppDataService } from '../../service';
import { download, upload } from './schema';
import AppDataFileService from './service';

export interface GraaspPluginFileOptions {
  maxFileSize?: number; // max size for an uploaded file in bytes

  appDataService: AppDataService;
}

export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const basePlugin: FastifyPluginAsyncTypebox<GraaspPluginFileOptions> = async (fastify, options) => {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,

    appDataService,
  } = options;

  const appDataFileService = resolveDependency(AppDataFileService);

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 5, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: maxFileSize, // For multipart forms, the max file size (Default: Infinity).
      files: 1, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  // register post delete handler to remove the file object after item delete
  const deleteHook = async (actor: Member, db: DBConnection, args: { appData: AppData }) => {
    await appDataFileService.deleteOne(args.appData);
  };
  appDataService.hooks.setPostHook('delete', deleteHook);

  fastify.route({
    method: HttpMethod.Post,
    url: '/app-data/upload',
    schema: upload,
    preHandler: guestAuthenticateAppsJWT,
    handler: async (request) => {
      const { user } = request;
      const member = asDefined(user?.account);
      const app = asDefined(user?.app);

      return db
        .transaction(async (tx) => {
          // files are saved in temporary folder in disk, they are removed when the response ends
          // necessary to get file size -> can use stream busboy only otherwise
          // only one file is uploaded
          const file = await request.file();
          if (!file) {
            throw new UploadEmptyFileError();
          }
          return addMemberInAppData(await appDataFileService.upload(tx, member, file, app.item));
        })
        .catch((e) => {
          console.error(e);

          // TODO rollback uploaded file

          if (e.code) {
            throw e;
          }
          throw new UploadFileUnexpectedError(e);
        });
    },
  });

  fastify.get(
    '/app-data/:id/download',
    {
      schema: download,
      preHandler: guestAuthenticateAppsJWT,
    },
    async (request) => {
      const {
        user,
        params: { id: appDataId },
      } = request;
      const member = asDefined(user?.account);
      const app = asDefined(user?.app);

      return appDataFileService
        .download(db,member, { item: app.item, appDataId })
        .catch((e) => {
          if (e.code) {
            throw e;
          }
          throw new DownloadFileUnexpectedError(e);
        });
    },
  );
};

export default basePlugin;
