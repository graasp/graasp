import path from 'path';
import { v4 } from 'uuid';

import { MultipartFile } from '@fastify/multipart';

import { AppDataVisibility, FileItemProperties, ItemType, UUID } from '@graasp/sdk';

import { AppDataRaw, ItemRaw } from '../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../types';
import FileService from '../../../../file/file.service';
import { NotAppDataFile } from './errors';
import { AppDataFileService } from './interfaces/appDataFileService';

export class AppDataFileServiceAdapter implements AppDataFileService {
  private readonly fileService: FileService;

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('apps', 'app-data', itemId, appDataId);
  }

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  async upload(account: AuthenticatedUser, file: MultipartFile, item: ItemRaw) {
    const { filename, mimetype, file: stream } = file;
    const appDataId = v4();
    const filepath = this.buildFilePath(item.id, appDataId); // parentId, filename

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
        throw e;
      });

    return {
      id: appDataId,
      type: ItemType.FILE,
      visibility: AppDataVisibility.Member,
      data: {
        [ItemType.FILE]: fileProperties,
      },
    };
  }

  async download(appData: AppDataRaw) {
    // check app data is a file
    // const appData = await this.appDataService.get(account, repositories, item, appDataId);
    const fileProp = appData.data[ItemType.FILE] as FileItemProperties;
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
      const fileProp = appData?.data?.[ItemType.FILE] as FileItemProperties;
      if (!fileProp) {
        return;
      }

      const filepath = fileProp.path;
      await this.fileService.delete(filepath);
    } catch (err) {
      // we catch the error, it ensures the item is deleted even if the file is not
      // this is especially useful for the files uploaded before the migration to the new plugin
      console.error(err);
    }
  }
}
