import contentDisposition from 'content-disposition';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'stream';

import { FastifyReply } from 'fastify';

import { Account, Member } from '@graasp/sdk';

import { BaseLogger } from '../../logger';
import { CachingService } from '../caching/service';
import { Actor } from '../member/entities/member';
import { LocalFileConfiguration, S3FileConfiguration } from './interfaces/configuration';
import { FileRepository } from './interfaces/fileRepository';
import { createSanitizedFile, sanitizeHtml } from './sanitize';
import {
  CopyFileInvalidPathError,
  CopyFolderInvalidPathError,
  DeleteFileInvalidPathError,
  DeleteFolderInvalidPathError,
  DownloadFileInvalidParameterError,
  UploadFileInvalidParameterError,
  UploadFileUnexpectedError,
} from './utils/errors';

export type FileServiceConfig = { s3?: S3FileConfiguration; local?: LocalFileConfiguration };

class FileService {
  private readonly repository: FileRepository;
  private readonly logger: BaseLogger;
  private readonly caching?: CachingService;

  constructor(repository: FileRepository, log: BaseLogger, caching?: CachingService) {
    this.repository = repository;
    this.caching = caching;
    this.logger = log;
  }

  getFileStorageType() {
    return this.repository.fileStorageType;
  }

  async getFileSize(actor: Actor, filepath: string) {
    return this.repository.getFileSize(filepath);
  }

  async upload(account: Account, data: { file: Readable; filepath: string; mimetype?: string }) {
    const { file, filepath, mimetype } = data;

    if (!file || !filepath) {
      throw new UploadFileInvalidParameterError({
        file,
        filepath,
      });
    }

    const sanitizedFile = await this.sanitizeFile({ file, mimetype });

    try {
      await this.repository.uploadFile({
        fileStream: sanitizedFile,
        filepath,
        memberId: account.id,
        mimetype,
      });
      await this.caching?.delete(filepath);
    } catch (e) {
      // rollback uploaded file
      this.delete(filepath);
      this.logger.error(e);
      throw new UploadFileUnexpectedError({ mimetype, memberId: account.id });
    }

    return data;
  }

  /**
   * Sanitize file content. Return readable file with updated content.
   * Filter out tags for HTML
   * @param file file to be sanitized
   * @param mimetype mimetype of the file
   * @returns sanitized stream
   */
  async sanitizeFile({ file, mimetype }: { file: Readable; mimetype?: string }): Promise<Readable> {
    // sanitize content of html
    if (mimetype === 'text/html') {
      return await createSanitizedFile(file, sanitizeHtml);
    }

    return file;
  }

  async getFile(_actor: Actor, data: { id?: string; path?: string }): Promise<Readable> {
    const { id, path: filepath } = data;
    if (!filepath || !id) {
      throw new DownloadFileInvalidParameterError();
    }

    return this.repository.getFile(
      {
        filepath,
        id,
      },
      this.logger,
    );
  }

  async getUrl(data: { expiration?: number; path?: string }): Promise<string> {
    const { expiration, path: filepath } = data;
    if (!filepath) {
      throw new DownloadFileInvalidParameterError();
    }

    const getUrl = () =>
      this.repository.getUrl(
        {
          expiration,
          filepath,
        },
        this.logger,
      );

    return this.caching?.getOrCache(filepath, getUrl, expiration) ?? getUrl();
  }

  async delete(filepath: string) {
    if (!filepath.length) {
      throw new DeleteFileInvalidPathError(filepath);
    }
    await this.repository.deleteFile({ filepath });
    await this.caching?.delete(filepath);
  }

  async deleteFolder(folderPath: string) {
    if (!folderPath.length) {
      throw new DeleteFolderInvalidPathError(folderPath);
    }

    await this.repository.deleteFolder({ folderPath });
  }

  async copy(
    member: Member,
    data: {
      newId?: string;
      newFilePath: string;
      originalPath: string;
      mimetype?: string;
    },
  ) {
    const { originalPath, newFilePath, newId, mimetype } = data;

    if (!originalPath.length) {
      throw new CopyFileInvalidPathError(originalPath);
    }
    if (!newFilePath.length) {
      throw new CopyFileInvalidPathError(newFilePath);
    }

    return this.repository.copyFile({
      newId,
      memberId: member.id,
      originalPath,
      newFilePath,
      mimetype,
    });
  }

  async copyFolder(data: { originalFolderPath: string; newFolderPath: string }) {
    const { originalFolderPath, newFolderPath } = data;

    if (!originalFolderPath.length) {
      throw new CopyFolderInvalidPathError(originalFolderPath);
    }
    if (!newFolderPath.length) {
      throw new CopyFolderInvalidPathError(newFolderPath);
    }

    return this.repository.copyFolder({
      originalFolderPath,
      newFolderPath,
    });
  }
  // should this be here?
  setHeaders({
    reply,
    id,
    replyUrl,
    url,
  }: {
    id: string;
    url: string;
    reply: FastifyReply;
    replyUrl?: boolean;
  }) {
    if (replyUrl) {
      // const replyUrlExpiration = S3_PRESIGNED_EXPIRATION;
      // reply.header('Cache-Control', `max-age=${replyUrlExpiration}`);
      reply.status(StatusCodes.OK).send(url);
    } else {
      // this header will make the browser download the file with 'name'
      // instead of simply opening it and showing it
      reply.header('Content-Disposition', contentDisposition(id));
      // TODO: necessary for localfiles ?
      // reply.type(mimetype);
      // It is necessary to add the header manually, because the redirect sends the request and
      // when the fastify-cors plugin try to add the header it's already sent and can't add it.
      // So we add it because otherwise the browser won't send the cookie
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.redirect(StatusCodes.MOVED_TEMPORARILY, url);
    }
  }
}

export default FileService;
