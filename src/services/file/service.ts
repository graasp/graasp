import { ReadStream } from 'fs';

import { FastifyReply } from 'fastify';

import { FileItemType, ItemType, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

import { UnauthorizedMember } from '../../utils/errors';
import { Actor } from '../member/entities/member';
import { FileRepository } from './interfaces/fileRepository';
import { LocalFileRepository } from './repositories/local';
import { S3FileRepository } from './repositories/s3';
import {
  CopyFileInvalidPathError,
  DeleteFileInvalidPathError,
  DeleteFolderInvalidPathError,
  DownloadFileInvalidParameterError,
  UploadEmptyFileError,
  UploadFileInvalidParameterError,
} from './utils/errors';
import { UploadFileUnexpectedError } from '../item/plugins/file/utils/errors';

class FileService {
  repository: FileRepository;
  /** file type */
  type: FileItemType;

  constructor(
    options: { s3?: S3FileConfiguration; local?: LocalFileConfiguration },
    fileItemType: FileItemType,
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
  }

  async upload(
    member: Actor,
    data?: { file: ReadStream; size: number; filepath: string; mimetype: string },
  ) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const { file, size, filepath, mimetype } = data ?? {};

    if (!file || !filepath) {
      throw new UploadFileInvalidParameterError({
        file,
        filepath,
        size,
      });
    }

    if (!size) {
      throw new UploadEmptyFileError({
        file,
        filepath,
        size,
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
      this.delete(member, {filepath}).catch(e=>console.error(e));

      console.error(e);
      throw new UploadFileUnexpectedError({mimetype, memberId:member.id, size});
    }

    return data;
  }

  async download(
    member: Actor,
    data: {
      reply?: FastifyReply;
      path?: string;
      mimetype?: string;
      fileStorage?: string;
      expiration?: number;
      replyUrl?: boolean;
      id: string;
    },
  ) {
    const { reply, id, path: filepath, mimetype, fileStorage, expiration, replyUrl } = data;
    if (!filepath || !id) {
      throw new DownloadFileInvalidParameterError({
        filepath,
        mimetype,
        id,
      });
    }

    return (
      this.repository.downloadFile({
        reply,
        filepath,
        mimetype,
        fileStorage,
        expiration,
        replyUrl,
        id,
      }) || null
    );
  }

  async delete(
    member: Actor,
    data: {
      filepath?: string;
    },
  ) {
    const { filepath } = data;

    if (!filepath) {
      throw new DeleteFileInvalidPathError(filepath);
    }
    await this.repository.deleteFile({ filepath });
  }

  async deleteFolder(
    member: Actor,
    data: {
      folderPath?: string;
    },
  ) {
    const { folderPath } = data;
    if (!folderPath) {
      throw new DeleteFolderInvalidPathError(folderPath);
    }

    await this.repository.deleteFolder({ folderPath });
  }

  async copy(
    member: Actor,
    data?: {
      newId?: string;
      newFilePath?: string;
      originalPath?: string;
      mimetype?: string;
    },
  ) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    const { originalPath, newFilePath, newId, mimetype } = data ?? {};

    if (!originalPath) {
      throw new CopyFileInvalidPathError(originalPath);
    }
    if (!newFilePath) {
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
    member: Actor,
    data: {
      originalFolderPath: string;
      newFolderPath: string;
    },
  ) {
    const { originalFolderPath, newFolderPath } = data;

    return this.repository.copyFolder({
      originalFolderPath,
      newFolderPath,
    });
  }
}

export default FileService;
