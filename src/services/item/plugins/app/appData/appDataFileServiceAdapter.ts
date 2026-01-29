import path from 'path';
import { v4 } from 'uuid';

import { MultipartFile } from '@fastify/multipart';

import { FileItemProperties, UUID } from '@graasp/sdk';

import { AppDataRaw, ItemRaw } from '../../../../../drizzle/types';
import { BaseLogger } from '../../../../../logger';
import { AuthenticatedUser } from '../../../../../types';
import FileService from '../../../../file/file.service';
import { NotAppDataFile } from './errors';
import { AppDataFileService } from './interfaces/appDataFileService';

export class AppDataFileServiceAdapter implements AppDataFileService {
  private readonly fileService: FileService;
  private readonly log: BaseLogger;

  constructor(fileService: FileService, log: BaseLogger) {
    this.fileService = fileService;
    this.log = log;
  }

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('apps', 'app-data', itemId, appDataId);
  }

  async upload(account: AuthenticatedUser, file: MultipartFile, item: ItemRaw) {
    const { filename, mimetype, file: stream } = file;
    const appDataId = v4();
    const filepath = this.buildFilePath(item.id, appDataId);

    const fileProperties = await this.fileService
      .upload(account, {
        file: stream,
        filepath,
        mimetype,
      })
      .then(() => {
        return { path: filepath, name: filename, mimetype };
      })
      .catch((e) => {
        this.log.error(e);
        throw e;
      });

    return {
      id: appDataId,
      type: 'file',
      data: {
        ['file']: fileProperties,
      },
    };
  }

  async download(appData: AppDataRaw) {
    // check app data is a file
    const fileProp = appData.data['file'] as FileItemProperties;
    if (!fileProp) {
      throw new NotAppDataFile(appData);
    }

    // always return the url because redirection uses bearer token automatically
    // and s3 prevent multiple auth methods
    const result = await this.fileService.getUrl({
      path: fileProp.path,
    });

    return result;
  }

  async deleteOne(appData: AppDataRaw) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      const fileProp = appData?.data?.['file'] as FileItemProperties;
      if (!fileProp) {
        return;
      }

      const filepath = fileProp.path;
      await this.fileService.delete(filepath);
    } catch (err) {
      // we catch the error, it ensures the item is deleted even if the file is not
      // this is especially useful for the files uploaded before the migration to the new plugin
      this.log.error(err);
    }
  }
}
