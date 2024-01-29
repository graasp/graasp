import contentDisposition from 'content-disposition';
import { ReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'stream';

import { FastifyBaseLogger, FastifyReply } from 'fastify';

import { FileItemType, ItemType } from '@graasp/sdk';

import { UnauthorizedMember } from '../../utils/errors';
import { Actor, Member } from '../member/entities/member';
import { LocalFileConfiguration, S3FileConfiguration } from './interfaces/configuration';
import { FileRepository } from './interfaces/fileRepository';
import { LocalFileRepository } from './repositories/local';
import { S3FileRepository } from './repositories/s3';
import { S3_PRESIGNED_EXPIRATION } from './utils/constants';
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
  repository: FileRepository;
  /** file type */
  type: FileItemType;

  config: { s3?: S3FileConfiguration; local?: LocalFileConfiguration };
  logger: FastifyBaseLogger;

  constructor(
    options: { s3?: S3FileConfiguration; local?: LocalFileConfiguration },
    fileItemType: FileItemType,
    log: FastifyBaseLogger,
  ) {
    this.type = fileItemType;
    switch (fileItemType) {
      case ItemType.S3_FILE:
        if (!options.s3) {
          throw new Error('S3 config is not defined');
        }
        this.repository = new S3FileRepository(options.s3);
        break;
      case ItemType.LOCAL_FILE:
      default:
        if (!options.local) {
          throw new Error('local config is not defined');
        }
        this.repository = new LocalFileRepository(options.local);
        break;
    }
    this.config = options;
    this.logger = log;
  }

  async getFileSize(actor: Actor, filepath: string) {
    return this.repository.getFileSize(filepath);
  }

  async upload(member: Member, data: { file: Readable; filepath: string; mimetype?: string }) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const { file, filepath, mimetype } = data;

    if (!file || !filepath) {
      throw new UploadFileInvalidParameterError({
        file,
        filepath,
      });
    }

    try {
      await this.repository.uploadFile({
        fileStream: file,
        filepath,
        memberId: member.id,
        mimetype,
      });
    } catch (e) {
      // rollback uploaded file
      this.delete(member, filepath);
      this.logger.error(e);
      throw new UploadFileUnexpectedError({ mimetype, memberId: member.id });
    }

    return data;
  }

  async getFile(member: Actor, data): Promise<ReadStream> {
    const { id, path: filepath } = data;
    if (!filepath || !id) {
      throw new DownloadFileInvalidParameterError({
        filepath,
        id,
      });
    }

    return this.repository.getFile(
      {
        filepath,
        id,
      },
      this.logger,
    );
  }

  async getUrl(
    member: Actor,
    data: {
      expiration?: number;
      id?: string;
      path?: string;
    },
  ): Promise<string> {
    const { expiration, id, path: filepath } = data;
    if (!filepath || !id) {
      throw new DownloadFileInvalidParameterError({
        filepath,
        id,
      });
    }

    return this.repository.getUrl(
      {
        expiration,
        filepath,
        id,
      },
      this.logger,
    );
  }

  async delete(member: Member, filepath: string) {
    if (!filepath.length) {
      throw new DeleteFileInvalidPathError(filepath);
    }
    await this.repository.deleteFile({ filepath });
  }

  async deleteFolder(member: Member, folderPath: string) {
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

  async copyFolder(
    member: Member,
    data: {
      originalFolderPath: string;
      newFolderPath: string;
    },
  ) {
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
      const replyUrlExpiration = S3_PRESIGNED_EXPIRATION;
      reply.header('Cache-Control', `max-age=${replyUrlExpiration}`);
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
