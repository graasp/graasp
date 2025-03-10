import { Readable } from 'stream';
import { singleton } from 'tsyringe';

import { Account } from '@graasp/sdk';

import { BaseLogger } from '../../logger';
import { MaybeUser, MinimalMember } from '../../types';
import { CachingService } from '../caching/service';
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

export type FileServiceConfig = {
  s3?: S3FileConfiguration;
  local?: LocalFileConfiguration;
};

class FileService {
  private readonly repository: FileRepository;
  private readonly logger: BaseLogger;
  private readonly caching?: CachingService;

  constructor(repository: FileRepository, log: BaseLogger, caching?: CachingService) {
    this.repository = repository;
    this.caching = caching;
    this.logger = log;
  }

  public get fileType() {
    return this.repository.fileType;
  }

  async getFileSize(actor: MaybeUser, filepath: string) {
    return this.repository.getFileSize(filepath);
  }

  async upload(account: Account, data: { file: Readable; filepath: string; mimetype?: string }) {
    const uploadedFiles = await this.uploadMany(account, [data]);
    return uploadedFiles[0];
  }

  async uploadMany(
    account: Account,
    data: { file: Readable; filepath: string; mimetype?: string }[],
  ) {
    data.forEach((fileInput) => {
      if (!fileInput.file || !fileInput.filepath) {
        throw new UploadFileInvalidParameterError({
          file: fileInput.file,
          filepath: fileInput.filepath,
        });
      }
    });

    const filepaths = data.map((d) => d.filepath);
    const filesToUpload = await Promise.all(
      data.map(async (fileInput) => {
        const sanitizedFile = await this.sanitizeFile({
          file: fileInput.file,
          mimetype: fileInput.mimetype,
        });
        return {
          fileStream: sanitizedFile,
          filepath: fileInput.filepath,
          memberId: account.id,
          mimetype: fileInput.mimetype,
        };
      }),
    );

    try {
      await this.repository.uploadFiles(filesToUpload);

      await this.caching?.deleteMany(filepaths);
    } catch (e) {
      // rollback all uploaded files
      this.deleteMany(filepaths);
      this.logger.error(e);
      throw new UploadFileUnexpectedError({ memberId: account.id });
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

  async getFile(_actor: MaybeUser, data: { id?: string; path?: string }): Promise<Readable> {
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
    return this.deleteMany([filepath]);
  }

  async deleteMany(filepaths: string[]) {
    filepaths.forEach((filepath) => {
      if (!filepath.length) {
        throw new DeleteFileInvalidPathError(filepath);
      }
    });

    await this.repository.deleteFiles(filepaths);
    await this.caching?.deleteMany(filepaths);
  }

  async deleteFolder(folderPath: string) {
    if (!folderPath.length) {
      throw new DeleteFolderInvalidPathError(folderPath);
    }

    await this.repository.deleteFolder({ folderPath });
  }

  async copy(
    member: MinimalMember,
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
}

export default FileService;
