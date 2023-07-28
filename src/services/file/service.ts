import { FastifyReply } from 'fastify';

import { FileItemType, ItemType, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

import { UnauthorizedMember } from '../../utils/errors';
import { Actor, Member } from '../member/entities/member';
import { FileRepository } from './interfaces/fileRepository';
import { LocalFileRepository } from './repositories/local';
import { S3FileRepository } from './repositories/s3';
import {
  CopyFileInvalidPathError,
  CopyFolderInvalidPathError,
  DeleteFileInvalidPathError,
  DeleteFolderInvalidPathError,
  DownloadFileInvalidParameterError,
  UploadEmptyFileError,
  UploadFileInvalidParameterError,
  UploadFileUnexpectedError,
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

  async getFileSize(actor: Actor, filepath: string) {
    return this.repository.getFileSize(filepath);
  }

  async upload(
    member: Member,
    data: { file: ReadableStream; filepath: string; mimetype?: string },
  ) {
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

    // if (!size) {
    //   throw new UploadEmptyFileError({
    //     file,
    //     filepath,
    //   });
    // }
    try {
      await this.repository.uploadFile({
        fileStream: file,
        filepath,
        memberId: member.id,
        mimetype,
      });
    } catch (e) {
      // rollback uploaded file
      this.delete(member, filepath).catch((e) => console.error(e));

      console.error(e);
      throw new UploadFileUnexpectedError({ mimetype, memberId: member.id });
    }

    return data;
  }

  async download(
    member: Actor,
    data: {
      expiration?: number;
      fileStorage?: string;
      id: string;
      mimetype?: string;
      path?: string;
      reply?: FastifyReply;
      replyUrl?: boolean;
    },
  ) {
    const { expiration, fileStorage, id, mimetype, path: filepath, reply, replyUrl } = data;
    if (!filepath || !id) {
      throw new DownloadFileInvalidParameterError({
        filepath,
        mimetype,
        id,
      });
    }

    return (
      this.repository.downloadFile({
        expiration,
        filepath,
        fileStorage,
        id,
        mimetype,
        reply,
        replyUrl,
      }) || null
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
}

export default FileService;
