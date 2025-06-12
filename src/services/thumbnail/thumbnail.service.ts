import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { pipeline as streamPipeline } from 'stream/promises';
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

  async upload(authenticatedUser: AuthenticatedUser, id: string, file: Readable) {
    // upload all thumbnails in parallel
    const filesToUpload = await Promise.all(
      Object.entries(ThumbnailSizeFormat).map(async ([sizeName, width]) => {
        // create thumbnail from image stream
        const pipeline = sharp().resize({ width }).toFormat(THUMBNAIL_FORMAT);
        await streamPipeline(file, pipeline);

        return {
          file: pipeline,
          filepath: this.buildFilePath(id, sizeName),
          mimetype: THUMBNAIL_MIMETYPE,
        };
      }),
    );

    // upload the thumbnails
    try {
      await this.fileService.uploadMany(authenticatedUser, filesToUpload);
    } catch (_err) {
      this.logger.debug(`Could not upload the ${id} item thumbnails`);
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
