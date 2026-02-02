import path from 'path';
import sharp, { type Sharp } from 'sharp';
import { Readable } from 'stream';
import { injectable } from 'tsyringe';

import { BaseLogger } from '../../logger';
import type { AuthenticatedUser } from '../../types';
import FileService from '../file/file.service';
import { THUMBNAIL_FORMAT, THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';

export const AVATAR_THUMBNAIL_PREFIX = 'avatars';
export const ITEM_THUMBNAIL_PREFIX = 'thumbnails';

@injectable()
export class ThumbnailService {
  private readonly fileService: FileService;
  private readonly logger: BaseLogger;
  private _prefix: string = ITEM_THUMBNAIL_PREFIX;

  constructor(fileService: FileService, log: BaseLogger) {
    this.fileService = fileService;
    this.logger = log;
  }

  public set prefix(prefix: string) {
    this._prefix = prefix;
  }

  private buildFilePath(itemId: string, name: string) {
    return path.join(this._prefix, itemId, name);
  }

  private buildFolderPath(itemId: string) {
    return path.join(this._prefix, itemId);
  }

  // cleanup helper for original input file and related sharp pipelines
  private destroyAll(
    file: Readable,
    image: Sharp,
    pipelines: { transform: Readable }[],
    err?: Error,
  ) {
    try {
      try {
        file.unpipe(image);
      } catch (_) {}
      image.destroy(err);
    } catch (_) {}
    for (const p of pipelines) {
      try {
        p.transform.destroy(err);
      } catch (_) {}
    }
  }

  // ensure errors on the source propagate
  private attachListeners(image: Sharp, file: Readable) {
    const onFileError = (err: Error) => {
      try {
        image.destroy(err);
      } catch (_) {}
    };
    file.on('error', onFileError);

    // catch errors from sharp processing or stream destruction
    const onImageError = (err: Error) => {
      this.logger.debug(`Image processing error during thumbnail upload: ${err.message}`);
    };
    image.on('error', onImageError);

    return { onFileError, onImageError };
  }

  // remove listeners to avoid leaks
  private removeListeners(file: Readable, image: Sharp, listeners: { onFileError; onImageError }) {
    try {
      file.removeListener('error', listeners.onFileError);
    } catch (_) {}
    try {
      image.removeListener('error', listeners.onImageError);
    } catch (_) {}
  }

  async upload(authenticatedUser: AuthenticatedUser, id: string, file: Readable) {
    // pipe incoming file into a sharp instance for further clone
    const image = sharp();
    file.pipe(image);

    // prepare pipelines per size
    const pipelines = Object.entries(ThumbnailSizeFormat).map(([sizeName, width]) => {
      const transform = image.clone().resize({ width }).toFormat(THUMBNAIL_FORMAT);
      return { transform, filepath: this.buildFilePath(id, sizeName), sizeName };
    });

    const listeners = this.attachListeners(image, file);

    try {
      // prepare upload payloads (the fileService will consume the readable sides)
      const filesToUpload = pipelines.map(({ transform, filepath }) => ({
        file: transform,
        filepath,
        mimetype: THUMBNAIL_MIMETYPE,
      }));

      await this.fileService.uploadMany(authenticatedUser, filesToUpload);
    } catch (err) {
      this.destroyAll(file, image, pipelines, err as Error);
      this.logger.debug(`Could not upload the ${id} item thumbnails`);
      throw err;
    } finally {
      this.removeListeners(file, image, listeners);
    }
  }

  async getUrl({ id, size }: { size: string; id: string }) {
    const result = await this.fileService.getUrl({
      path: this.buildFilePath(id, size),
    });

    return result;
  }

  async getFile({ id, size }: { id: string; size: string }) {
    const file = await this.fileService.getFile({
      path: this.buildFilePath(id, size),
      id,
    });

    return file;
  }

  async delete({ id, size }: { size: string; id: string }) {
    const filePath = this.buildFilePath(id, size);
    await this.fileService.delete(filePath);
  }

  async copyFolder(
    authenticatedUser: AuthenticatedUser,
    { originalId, newId }: { originalId: string; newId: string },
  ) {
    const originalFolderPath = this.buildFolderPath(originalId);
    const newFolderPath = this.buildFolderPath(newId);
    await this.fileService.copyFolder({ originalFolderPath, newFolderPath });
  }
}

/**
 * Allow to inject the ThumbnailService with a specific prefix.
 */
export class ThumbnailServiceTransformer {
  public transform(thumbnailService: ThumbnailService, prefix: string) {
    thumbnailService.prefix = prefix;
    return thumbnailService;
  }
}
