import { ReadStream } from 'fs';

import { FastifyReply } from 'fastify';

import {
  Actor,
  FileItemType,
  ItemType,
  LocalFileConfiguration,
  S3FileConfiguration,
} from '@graasp/sdk';

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
  ): Promise<any> {
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
      // TODO rollback uploaded file

      console.error(e);
      throw e;
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
  ): Promise<any> {
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
  ): Promise<any> {
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
  ): Promise<any> {
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
  ): Promise<any> {
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
  ): Promise<any> {
    const { originalFolderPath, newFolderPath } = data;

    return this.repository.copyFolder({
      originalFolderPath,
      newFolderPath,
    });
  }
}

export default FileService;
