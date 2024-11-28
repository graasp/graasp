import path from 'path';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import { MultipartFile } from '@fastify/multipart';

import { AppDataVisibility, FileItemProperties, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../../../../utils/repositories';
import { Account } from '../../../../../../account/entities/account';
import FileService from '../../../../../../file/service';
import { Item } from '../../../../../entities/Item';
import { APP_DATA_TYPE_FILE } from '../../../constants';
import { AppData } from '../../appData';
import { NotAppDataFile } from '../../errors';
import { AppDataService } from '../../service';

@singleton()
class AppDataFileService {
  private readonly appDataService: AppDataService;
  private readonly fileService: FileService;

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('apps', 'app-data', itemId, appDataId);
  }

  constructor(appDataService: AppDataService, fileService: FileService) {
    this.appDataService = appDataService;
    this.fileService = fileService;
  }

  async upload(account: Account, repositories: Repositories, file: MultipartFile, item: Item) {
    const { filename, mimetype, file: stream } = file;
    const appDataId = v4();
    const filepath = this.buildFilePath(item.id, appDataId); // parentId, filename

    // compute body data from file's fields
    // if (fields) {
    //   const fileBody = Object.fromEntries(
    //     Object.keys(fields).map((key) => [
    //       key,
    //       (fields[key] as unknown as { value: string })?.value,
    //     ]),
    //   );
    // }

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

    // remove undefined values
    // const values = { ...fileBody };
    // Object.keys(values).forEach((key) => values[key] === undefined && delete values[key]);

    // const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);

    const appData = await repositories.appDataRepository.addOne({
      itemId: item.id,
      actorId: account.id,
      appData: {
        id: appDataId,
        type: APP_DATA_TYPE_FILE,
        visibility: AppDataVisibility.Member,
        data: {
          [this.fileService.fileType]: fileProperties,
        },
      },
    });

    return appData;
  }

  async download(
    account: Account,
    repositories: Repositories,
    { item, appDataId }: { item: Item; appDataId: UUID },
  ) {
    // get app data and check it is a file
    const appData = await this.appDataService.get(account, repositories, item, appDataId);
    const fileProp = appData.data[this.fileService.fileType] as FileItemProperties;
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

  async deleteOne(appData: AppData) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      const fileProp = appData?.data?.[this.fileService.fileType] as FileItemProperties;
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
