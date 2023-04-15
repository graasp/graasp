import { existsSync, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';

import { SavedMultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import FileService from '../file/service';
import { THUMBNAIL_MIMETYPE,  } from './constants';
import { createThumbnails } from './utils';
import { TMP_FOLDER } from '../../utils/config';

export class ThumbnailService {
  fileService: FileService;
  shouldRedirectOnDownload: boolean;
  prefix: string;

  constructor(fileService: FileService, shouldRedirectOnDownload: boolean, prefix: string) {
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.fileService = fileService;
    this.prefix = prefix ?? 'thumbnails';
  }

  buildFilePath(itemId: string, name: string) {
    // TODO: CHANGE ??
    return path.join(this.prefix, itemId, name);
  }

  async upload(actor, id: string, file: SavedMultipartFile) {
    // ?? it might not be saved correctly in the original upload
    const fileStorage = path.join(TMP_FOLDER, 'thumbnails', id);
    mkdirSync(fileStorage, { recursive: true });

    try {
      // create thumbnails from image
      // Warning: assume stream is defined with a filepath
      const thumbnails = await createThumbnails(file.filepath as string, id, fileStorage);

      // upload all thumbnails
      await Promise.all(
        thumbnails.map(({ sizeName, size, fileStream }) =>
          this.fileService.upload(actor, {
            file: fileStream,
            filepath: this.buildFilePath(id, sizeName),
            mimetype: THUMBNAIL_MIMETYPE,
            size,
          }),
        ),
      );
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      if (existsSync(fileStorage)) {
        rm(fileStorage, { recursive: true }).catch((e) => console.error(e));
      } else {
        // do not throw if folder has already been deleted
        // log?.error(`${fileStorage} was not found, and was not deleted`);
      }
    }
  }

  async download(
    actor,
    {
      reply,
      id,
      size,
      replyUrl,
    }: { reply: FastifyReply; size: string; id: string; replyUrl?: boolean },
  ) {
    const result = await this.fileService.download(actor, {
      reply: this.shouldRedirectOnDownload ? reply : undefined,
      replyUrl,
      path: this.buildFilePath(id, size),
      mimetype: THUMBNAIL_MIMETYPE,
      id,
    });

    return result;
  }
}
