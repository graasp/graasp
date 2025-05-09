import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { injectable } from 'tsyringe';

import { AuthenticatedUser } from '../../types';
import FileService from '../file/file.service';
import { THUMBNAIL_FORMAT, THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';

export const AVATAR_THUMBNAIL_PREFIX = 'avatars';
export const ITEM_THUMBNAIL_PREFIX = 'thumbnails';

@injectable()
export class ThumbnailService {
  private readonly fileService: FileService;
  private _prefix: string = ITEM_THUMBNAIL_PREFIX;

  constructor(fileService: FileService) {
    this.fileService = fileService;
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
    await Promise.all(
      Object.entries(ThumbnailSizeFormat).map(async ([sizeName, width]) => {
        // create thumbnail from image stream
        const pipeline = sharp().resize({ width }).toFormat(THUMBNAIL_FORMAT);
        file.pipe(pipeline);

        await new Promise((resolve, reject) =>
          pipeline
            .on('finish', () => {
              resolve(true);
            })
            .on('error', reject),
        );

        // upload file
        await this.fileService.upload(authenticatedUser, {
          file: pipeline,
          filepath: this.buildFilePath(id, sizeName),
          mimetype: THUMBNAIL_MIMETYPE,
        });
      }),
    );
  }

  async getUrl({ id, size }: { size: string; id: string }) {
    const result = await this.fileService.getUrl({
      path: this.buildFilePath(id, size),
    });

    return result;
  }

  async getFile({ id, size }: { id: string; size: string }) {
    try {
      return this.fileService.getFile({
        path: this.buildFilePath(id, size),
        id,
      });
    } catch (_err) {
      return undefined;
    }
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
