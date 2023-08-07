import extract from 'extract-zip';
import fs from 'fs';
import { lstat, mkdir, readdir } from 'fs/promises';
import mime from 'mime';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';

import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { H5PItemExtra, H5PItemType, ItemType, PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Actor, Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import {
  DEFAULT_H5P_ASSETS_ROUTE,
  DEFAULT_H5P_CONTENT_ROUTE,
  DEFAULT_MIME_TYPE,
  H5P_FILE_DOT_EXTENSION,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_NON_FILE_FIELDS,
  PLUGIN_NAME,
} from './constants';
import { GraaspH5PError, H5PImportError, H5PInvalidFileError } from './errors';
import { renderHtml } from './integration';
import { h5pImport } from './schemas';
import { H5PService } from './service';
import { FastifyStaticReply, H5PPluginOptions } from './types';
import { buildContentPath, buildH5PPath, buildRootPath, validatePluginOptions } from './utils';
import { H5PValidator } from './validation/h5p-validator';

const plugin: FastifyPluginAsync<H5PPluginOptions> = async (fastify, options) => {
  // get services from server instance
  const {
    items: { service: itemService },
    db,
  } = fastify;

  validatePluginOptions(options);
  const {
    tempDir = path.resolve(os.tmpdir(), 'graasp', 'h5p'),
    routes,
    hosts,
    fileStorage,
  } = options;
  const { pathPrefix = '' } = fileStorage;

  // create temp extraction dir if it does not exist
  fs.mkdirSync(tempDir, { recursive: true });

  // todo: file service should be a singleton with mutliple storage drivers
  const fileService = new FileService(fileStorage.config, fileStorage.type);

  const h5pValidator = new H5PValidator();

  const h5pService = new H5PService(fileService, pathPrefix);
  fastify.decorate('h5p', h5pService);

  /**
   * Uploads both the .h5p and the package content into public storage
   * Recursive function to traverse and upload the H5P folder
   * IMPORTANT: the top-down traversal must not wait for long (ensures that files
   * are uploaded in parallel as soon as possible). Results aggregation can however
   * await in parallel (note: await in a map fn does not block the map iteration).
   */
  async function uploadH5P(
    folder: string,
    uploadPath: string,
    member: Actor,
    log: FastifyBaseLogger,
  ): Promise<Array<string>> {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const children = await readdir(folder);

    // we will flatMap with promises: first map
    const uploads = children.map(async (child) => {
      const childPath = path.join(folder, child);
      const childUploadPath = path.join(uploadPath, child);
      const stats = await lstat(childPath);

      if (stats.isDirectory()) {
        // recursively upload child folder
        return await uploadH5P(childPath, childUploadPath, member, log);
      } else {
        // ignore this file if extension is not allowed
        const ext = path.extname(childPath);
        if (!h5pValidator.isExtensionAllowed(ext)) {
          log.info('H5P import: illegal file extension detected, skipping file: ', childPath);
          // we're using flatMap, represent none value with empty array
          return [];
        }

        const mimetype = mime.getType(ext) ?? DEFAULT_MIME_TYPE;
        await fileService.upload(member, {
          file: fs.createReadStream(childPath),
          filepath: childUploadPath,
          mimetype,
        });

        // we're using flatMap, wrap result in array
        return [childUploadPath];
      }
    });
    // then resolve promises array and flatten
    return (await Promise.all(uploads)).flat();
  }

  /**
   * Helper to create H5P extra
   */
  function buildH5PExtra(contentId: string, filename: string): H5PItemExtra {
    return {
      h5p: {
        contentId,
        h5pFilePath: buildH5PPath(contentId, filename), // <contentId>/<filename>.h5p
        contentFilePath: buildContentPath(contentId), // <contentId>/content
      },
    };
  }

  /**
   * Creates a Graasp item for the uploaded H5P package
   * @param filename Name of the original H5P file WITHOUT EXTENSION
   * @param contentId Storage ID of the remote content
   * @param remoteRootPath Root path on the remote storage
   * @param member Actor member
   * @param parentId Optional parent id of the newly created item
   */
  async function createH5PItem(
    filename: string,
    contentId: string,
    member: Member,
    parentId?: string,
  ): Promise<Item> {
    const metadata = {
      name: buildH5PPath('', filename),
      type: ItemType.H5P,
      extra: buildH5PExtra(contentId, filename),
    };
    return db.transaction(async (manager) => {
      return itemService.post(member, buildRepositories(manager), {
        item: metadata,
        parentId,
      });
    });
  }

  /**
   * In local storage mode, proxy serve the H5P content files
   * In the future, consider refactoring the fileService so that it can be grabbed from the
   * core instance and can serve the files directly (with an option to use or not auth)
   */
  if (fileStorage.type === ItemType.LOCAL_FILE) {
    /** Helper to set CORS headers policy */
    const setHeaders = (response: FastifyStaticReply) => {
      response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    };

    // serve integration html
    const integrationRoute = path.join(
      routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE,
      'integration.html',
    );
    fastify.get(integrationRoute, async (req, res) => {
      const html = renderHtml(
        routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE,
        routes?.content ?? DEFAULT_H5P_CONTENT_ROUTE,
        hosts ?? ['localhost'],
      );
      res.send(html);
    });

    // hack to serve the "dist" folder of package "h5p-standalone"
    const h5pAssetsRoot = path.dirname(require.resolve('h5p-standalone'));
    fastify.register(fastifyStatic, {
      root: h5pAssetsRoot,
      prefix: routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE,
      decorateReply: false,
      setHeaders,
    });

    const h5pStorageRoot = path.join(fileStorage.config.local.storageRootPath, pathPrefix);
    fs.mkdirSync(h5pStorageRoot, { recursive: true });
    fastify.register(fastifyStatic, {
      root: h5pStorageRoot,
      prefix: routes?.content ?? DEFAULT_H5P_CONTENT_ROUTE,
      decorateReply: false,
      setHeaders,
    });
  }

  /*
    we create an artificial plugin scope, so that fastify-multipart does not conflict
    with other instances since we use fp to remove the outer scope
  */
  await fastify.register(async (fastify) => {
    fastify.register(fastifyMultipart, {
      limits: {
        fields: MAX_NON_FILE_FIELDS,
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE,
      },
    });

    /* routes in this scope are authenticated */
    fastify.addHook('preHandler', fastify.verifyAuthentication);

    fastify.post<{ Querystring: { parentId?: string } }>(
      '/h5p-import',
      { schema: h5pImport },
      async (request) => {
        const {
          member,
          log,
          query: { parentId },
        } = request;

        return db.transaction(async (manager) => {
          if (!member) {
            throw new UnauthorizedMember(member);
          }

          const repositories = buildRepositories(manager);

          // validate write permission in parent if it exists
          if (parentId) {
            const item = await itemService.get(member, repositories, parentId);
            await validatePermission(repositories, PermissionLevel.Write, member, item);
          }

          // WARNING: cannot destructure { file } = request, which triggers an undefined TypeError internally
          // (maybe getter performs side-effect on promise handler?)
          // so use request.file notation instead
          const h5pFile = await request.file();

          if (!h5pFile) {
            throw new H5PInvalidFileError(h5pFile);
          }

          /*
          // uppy tries to guess the mime type but fails and falls back to application/octet-stream, so we disable this check for now
          if (h5pFile.mimetype !== H5P_FILE_MIME_TYPE) {
            throw new InvalidH5PFileError(h5pFile.mimetype);
          }
          */

          const contentId = v4();
          const tmpDir = await tmp.dir({ tmpdir: tempDir, unsafeCleanup: true });
          const targetFolder = path.join(tmpDir.path, contentId);
          const remoteRootPath = buildRootPath(pathPrefix, contentId);

          await mkdir(targetFolder, { recursive: true });
          const baseName = path.basename(h5pFile.filename, H5P_FILE_DOT_EXTENSION);

          // try-catch block for local storage cleanup
          try {
            const savePath = buildH5PPath(targetFolder, baseName);
            const contentFolder = buildContentPath(targetFolder);

            // save H5P file
            await pipeline(h5pFile.file, fs.createWriteStream(savePath));
            await extract(savePath, { dir: contentFolder });

            const result = await h5pValidator.validatePackage(contentFolder);
            if (!result.isValid) {
              throw new H5PInvalidFileError((result as { error: string }).error);
            }

            // try-catch block for remote storage cleanup
            try {
              // upload whole folder to public storage
              await uploadH5P(targetFolder, remoteRootPath, member, log);
              const item = await createH5PItem(baseName, contentId, member, parentId);
              return item;
            } catch (error) {
              // delete public storage folder of this H5P if upload or creation fails
              await fileService.deleteFolder(member, remoteRootPath);
              // rethrow above
              throw error;
            }
            // end of try-catch block for remote storage cleanup
          } catch (error) {
            // log and rethrow to let fastify handle the error response
            log.error('graasp-plugin-h5p: unexpected error occured while importing H5P:');
            log.error(error);
            // wrap into plugin error type if not ours
            if (!(error instanceof GraaspH5PError)) {
              error = new H5PImportError();
            }
            throw error;
          } finally {
            // in all cases, remove local temp folder
            await tmpDir.cleanup();
          }
          // end of try-catch block for local storage cleanup
        });
      },
    );
  });

  /**
   * Delete H5P assets on item delete
   */
  itemService.hooks.setPostHook('delete', async (actor, repositories, { item }) => {
    if (item.type !== ItemType.H5P) {
      return;
    }
    if (!actor) {
      return;
    }
    // TODO: fix types
    const { extra } = item as H5PItemType;
    const folderPath = buildRootPath(pathPrefix, extra.h5p.contentId);
    await fileService.deleteFolder(actor, folderPath);
  });

  /**
   * Copy H5P assets on item copy
   */
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original: item, copy }) => {
    // only execute this handler for H5P item types
    if (item.type !== ItemType.H5P) {
      return;
    }
    if (!actor) {
      return;
    }

    // TODO: fix types
    const { extra } = item as H5PItemType;

    const baseName = path.basename(item.name, H5P_FILE_DOT_EXTENSION);
    const copySuffix = '-1';
    const newName = `${baseName}${copySuffix}`;

    const newContentId = v4();
    const remoteRootPath = buildRootPath(pathPrefix, newContentId);

    // copy .h5p file
    await fileService.copy(actor, {
      originalPath: path.join(pathPrefix, extra.h5p.h5pFilePath),
      newFilePath: buildH5PPath(remoteRootPath, newName),
    });
    // copy content folder
    await fileService.copyFolder(actor, {
      originalFolderPath: path.join(pathPrefix, extra.h5p.contentFilePath),
      newFolderPath: buildContentPath(remoteRootPath),
    });

    item.name = buildH5PPath('', newName);
    item.extra.h5p = buildH5PExtra(newContentId, newName).h5p;
  });
};

export default fp(plugin, {
  fastify: '4.x',
  name: PLUGIN_NAME,
});
