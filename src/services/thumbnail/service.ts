import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';

import FileService from '../file/service';
import { Actor, Member } from '../member/entities/member';
import { THUMBNAIL_FORMAT, THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';

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
    return path.join(this.prefix, itemId, name);
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
}
