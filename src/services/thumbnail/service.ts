import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { injectable } from 'tsyringe';

import FileService from '../file/service';
import { Actor, Member } from '../member/entities/member';
import { THUMBNAIL_FORMAT, THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';

export const AVATAR_THUMBNAIL_PREFIX = 'avatars';
export const ITEM_THUMBNAIL_PREFIX = 'thumbnails';

@injectable()
export class ThumbnailService {
  private readonly fileService: FileService;
  private prefix: string = ITEM_THUMBNAIL_PREFIX;

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  public setPrefix(prefix: string) {
    this.prefix = prefix;
  }

  buildFilePath(itemId: string, name: string) {
    return path.join(this.prefix, itemId, name);
  }

  buildFolderPath(itemId: string) {
    return path.join(this.prefix, itemId);
  }

  async upload(actor: Member, id: string, file: Readable) {
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
        await this.fileService.upload(actor, {
          file: pipeline,
          filepath: this.buildFilePath(id, sizeName),
          mimetype: THUMBNAIL_MIMETYPE,
        });
      }),
    );
  }

  async getUrl(actor: Actor, { id, size }: { size: string; id: string }) {
    const result = await this.fileService.getUrl(actor, {
      path: this.buildFilePath(id, size),
      id,
    });

    return result;
  }
  async getFile(actor: Actor, { id, size }: { size: string; id: string }) {
    const result = await this.fileService.getFile(actor, {
      path: this.buildFilePath(id, size),
      id,
    });

    return result;
  }

  async delete(actor: Member, { id, size }: { size: string; id: string }) {
    const filePath = this.buildFilePath(id, size);
    await this.fileService.delete(actor, filePath);
  }

  async copyFolder(actor: Member, { originalId, newId }: { originalId: string; newId: string }) {
    const originalFolderPath = this.buildFolderPath(originalId);
    const newFolderPath = this.buildFolderPath(newId);
    await this.fileService.copyFolder(actor, { originalFolderPath, newFolderPath });
  }
}
