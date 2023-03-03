import { existsSync, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';

import { SavedMultipartFile } from '@fastify/multipart';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../util/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { THUMBNAIL_MIMETYPE, TMP_FOLDER } from './utils/constants';
import { createThumbnails } from './utils/helpers';

export class ThumbnailService {
  fileService: FileService;
  shouldRedirectOnDownload: boolean;

  constructor(fileService: FileService, shouldRedirectOnDownload) {
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.fileService = fileService;
  }

  buildFilePath(itemId: string, name: string) {
    // TODO: CHANGE ??
    return path.join('thumbnails', itemId, name);
  }

  async upload(actor, repositories: Repositories, itemId: string, file: SavedMultipartFile) {
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Write, actor, item);

    try {
      // ?? it might not be saved correctly in the original upload
      const fileStorage = path.join(__dirname, TMP_FOLDER, itemId);
      mkdirSync(fileStorage, { recursive: true });

      // create thumbnails from image
      // Warning: assume stream is defined with a filepath
      const thumbnails = await createThumbnails(file.filepath as string, itemId, fileStorage);

      // upload all thumbnails
      await Promise.all(
        thumbnails.map(({ name, size, fileStream }) =>
          this.fileService.upload(actor, {
            file: fileStream,
            filepath: this.buildFilePath(itemId, name),
            mimetype: THUMBNAIL_MIMETYPE,
            size,
          }),
        ),
      );
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      // delete tmp files after upload
      const fileStorage = path.join(__dirname, TMP_FOLDER, itemId);
      if (existsSync(fileStorage)) {
        rm(fileStorage, { recursive: true }).catch((e) => console.error(e));
      } else {
        // do not throw if folder has already been deleted
        // log?.error(`${fileStorage} was not found, and was not deleted`);
      }
    }
    return item;
  }

  async download(actor, repositories: Repositories, { reply, size, itemId, replyUrl }) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const result = await this.fileService.download(actor, {
      reply: this.shouldRedirectOnDownload ? reply : null,
      itemId,
      replyUrl,
      path: this.buildFilePath(itemId, size),
      mimetype: THUMBNAIL_MIMETYPE,
    });

    return result;
  }
}
