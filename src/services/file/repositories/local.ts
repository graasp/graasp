import fs from 'fs';
import { copy as fseCopy } from 'fs-extra';
import { access, copyFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import { ItemType } from '@graasp/sdk';

import { LocalFileConfiguration } from '../interfaces/configuration';
import { FileRepository } from '../interfaces/fileRepository';
import { LocalFileNotFound } from '../utils/errors';

export class LocalFileRepository implements FileRepository {
  private readonly options: LocalFileConfiguration;

  constructor(options: LocalFileConfiguration) {
    this.options = options;
  }

  get fileType() {
    return ItemType.LOCAL_FILE;
  }

  buildFullPath = (filepath: string) => path.join(this.options.storageRootPath, filepath);

  async getFileSize(filepath: string) {
    const metadata = fs.statSync(this.buildFullPath(filepath));
    return metadata.size;
  }

  // copy
  async copyFile({ originalPath, newFilePath }) {
    const originalFullPath = this.buildFullPath(originalPath);
    const newFileFullPath = this.buildFullPath(newFilePath);

    await mkdir(path.dirname(newFileFullPath), { recursive: true });

    await copyFile(originalFullPath, newFileFullPath);

    return newFilePath;
  }

  async copyFolder({ originalFolderPath, newFolderPath }): Promise<string> {
    const originalFullPath = this.buildFullPath(originalFolderPath);
    const newFullPath = this.buildFullPath(newFolderPath);

    await mkdir(path.dirname(newFullPath), { recursive: true });

    // use fs-extra for recursive folder copy
    await fseCopy(originalFullPath, newFullPath);

    return newFolderPath;
  }

  // delete
  async deleteFile({ filepath }): Promise<void> {
    await rm(this.buildFullPath(filepath));
  }
  // delete
  async deleteFolder({ folderPath }): Promise<void> {
    await rm(this.buildFullPath(folderPath), { recursive: true });
  }

  private async _validateFile({ filepath }: { filepath: string }) {
    // ensure the file exists, if not throw error
    try {
      await access(this.buildFullPath(filepath));
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new LocalFileNotFound({ filepath });
      }
      throw e;
    }
  }

  async getFile({ filepath }: { filepath: string }) {
    await this._validateFile({ filepath });
    return fs.createReadStream(this.buildFullPath(filepath));
  }

  async getUrl({ filepath }) {
    await this._validateFile({ filepath });
    const localUrl = new URL(filepath, this.options.localFilesHost);
    return localUrl.toString();
  }

  // upload
  async uploadFile({ fileStream, filepath }): Promise<void> {
    const folderPath = path.dirname(this.buildFullPath(filepath));
    // create folder
    await mkdir(folderPath, {
      recursive: true,
    });

    // create file at path
    await pipeline(fileStream, fs.createWriteStream(this.buildFullPath(filepath)));
  }
}
