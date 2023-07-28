import { WriteStream } from 'fs';
import path from 'path';

import { FastifyReply } from 'fastify';

import FileService from '../file/service';
import { Actor, Member } from '../member/entities/member';
import { THUMBNAIL_MIMETYPE } from './constants';
import { createThumbnails } from './utils';

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

  async upload(actor: Member, id: string, file: WriteStream) {
    // create thumbnails from image stream
    // Warning: assume stream is defined with a filepath
    const thumbnails = await createThumbnails(file);

    // upload all thumbnails
    await Promise.all(
      thumbnails.map(({ sizeName, fileStream }) =>
        this.fileService.upload(actor, {
          file: fileStream,
          filepath: this.buildFilePath(id, sizeName),
          mimetype: THUMBNAIL_MIMETYPE,
        }),
      ),
    );
  }

  async download(
    actor: Actor,
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
