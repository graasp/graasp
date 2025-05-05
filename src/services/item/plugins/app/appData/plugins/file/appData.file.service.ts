import path from 'path';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import { MultipartFile } from '@fastify/multipart';

import { AppDataVisibility, FileItemProperties, ItemType, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../../../../drizzle/db';
import { AppDataRaw, ItemRaw } from '../../../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../../../types';
import FileService from '../../../../../../file/file.service';
import { APP_DATA_TYPE_FILE } from '../../../constants';
import { AppDataRepository } from '../../appData.repository';
import { AppDataService } from '../../appData.service';
import { NotAppDataFile } from '../../errors';

@singleton()
class AppDataFileService {
  private readonly appDataService: AppDataService;
  private readonly fileService: FileService;
  private readonly appDataRepository: AppDataRepository;

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('apps', 'app-data', itemId, appDataId);
  }

  constructor(
    appDataService: AppDataService,
    fileService: FileService,
    appDataRepository: AppDataRepository,
  ) {
    this.appDataService = appDataService;
    this.fileService = fileService;
    this.appDataRepository = appDataRepository;
  }

  async upload(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    file: MultipartFile,
    item: ItemRaw,
  ) {
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

    const appData = await this.appDataRepository.addOne(dbConnection, {
      itemId: item.id,
      actorId: account.id,
      appData: {
        id: appDataId,
        type: APP_DATA_TYPE_FILE,
        visibility: AppDataVisibility.Member,
        data: {
          [ItemType.FILE]: fileProperties,
        },
      },
    });

    return appData;
  }

  async download(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    { item, appDataId }: { item: ItemRaw; appDataId: UUID },
  ) {
    // get app data and check it is a file
    const appData = await this.appDataService.get(dbConnection, account, item, appDataId);
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

  async deleteOne(dbConnection: DBConnection, appData: AppDataRaw) {
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

export default AppDataFileService;
