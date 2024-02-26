import fs from 'fs';
import fse from 'fs-extra';
import { access, copyFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import { LocalFileConfiguration } from '../interfaces/configuration';
import { FileRepository } from '../interfaces/fileRepository';
import { LocalFileNotFound } from '../utils/errors';

export class LocalFileRepository implements FileRepository {
  private readonly options: LocalFileConfiguration;

  constructor(options: LocalFileConfiguration) {
    this.options = options;
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
    await fse.copy(originalFullPath, newFullPath);

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

  private async _validateFile({ id, filepath }: { id?: string; filepath: string }) {
    // ensure the file exists, if not throw error
    try {
      await access(this.buildFullPath(filepath));
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new LocalFileNotFound({ id, filepath });
      }
      throw e;
    }
  }

  async getFile({ filepath, id }) {
    await this._validateFile({ filepath, id });
    return fs.createReadStream(this.buildFullPath(filepath));
  }

  async getUrl({ filepath, id }) {
    await this._validateFile({ filepath, id });

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
