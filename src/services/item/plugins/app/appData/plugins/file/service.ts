import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { SavedMultipartFile } from '@fastify/multipart';

import { FileItemProperties, UUID } from '@graasp/sdk';

import { ItemNotFound, UnauthorizedMember } from '../../../../../../../utils/errors';
import { Repositories } from '../../../../../../../utils/repositories';
import FileService from '../../../../../../file/service';
import { Actor } from '../../../../../../member/entities/member';
import ItemService from '../../../../../service';
import { APP_DATA_TYPE_FILE } from '../../../constants';
import { AppDataVisibility } from '../../../interfaces/app-details';
import { AppData } from '../../appData';
import { NotAppDataFile } from '../../errors';
import { AppDataService } from '../../service';

class AppDataFileService {
  appDataService: AppDataService;
  fileService: FileService;
  itemService: ItemService;

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('apps', 'app-data', itemId, appDataId);
  }

  constructor(appDataService: AppDataService, fileService: FileService, itemService: ItemService) {
    this.appDataService = appDataService;
    this.fileService = fileService;
    this.itemService = itemService;
  }

  async upload(
    actorId: string | undefined,
    repositories: Repositories,
    fileObject: Partial<SavedMultipartFile> &
      Pick<SavedMultipartFile, 'filename' | 'mimetype' | 'filepath'>,
    itemId?: string,
  ) {
    const { memberRepository } = repositories;

    if (!actorId) {
      throw new UnauthorizedMember(actorId);
    }
    const member = await memberRepository.get(actorId);

    // check rights
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    // posting an app data is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    const { filename, mimetype, fields, filepath: tmpPath } = fileObject;
    const file = fs.createReadStream(tmpPath);
    const { size } = fs.statSync(tmpPath);
    const appDataId = v4();
    const filepath = this.buildFilePath(itemId, appDataId); // parentId, filename

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
      .upload(member, {
        file,
        filepath,
        mimetype,
        size,
      })
      .then(() => {
        return { path: filepath, name: filename, size, mimetype };
      })
      .catch((e) => {
        throw e;
      });

    // remove undefined values
    // const values = { ...fileBody };
    // Object.keys(values).forEach((key) => values[key] === undefined && delete values[key]);

    // const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);

    const appData = await repositories.appDataRepository.post(itemId, member.id, {
      id: appDataId,
      type: APP_DATA_TYPE_FILE,
      visibility: AppDataVisibility.MEMBER,
      data: {
        [this.fileService.type]: fileProperties,
      },
    });

    return appData;
  }

  async download(
    actorId: string | undefined,
    repositories: Repositories,
    { itemId, appDataId }: { itemId?: UUID; appDataId: UUID },
  ) {
    const { memberRepository } = repositories;
    let member: Actor;
    if (actorId) {
      member = await memberRepository.get(actorId);
    }
    // check rights
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    await this.itemService.get(member, repositories, itemId);

    // get app data and check it is a file
    const appData = await this.appDataService.get(actorId, repositories, itemId, appDataId);
    const fileProp = appData.data[this.fileService.type] as FileItemProperties;
    if (!fileProp) {
      throw new NotAppDataFile(appData);
    }

    const result = await this.fileService.download(member, {
      id: appData.id,
      // always return the url because redirection uses bearer token automatically
      // and s3 prevent multiple auth methods
      replyUrl: true,
      ...fileProp,
    });

    return result;
  }

  async deleteOne(actor, repositories: Repositories, appData: AppData) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      const fileProp = appData?.data?.[this.fileService.type] as FileItemProperties;
      if (!fileProp) {
        return;
      }

      const filepath = fileProp.path;
      await this.fileService.delete(actor, { filepath });
    } catch (err) {
      // we catch the error, it ensures the item is deleted even if the file is not
      // this is especially useful for the files uploaded before the migration to the new plugin
      console.error(err);
    }
  }
}

export default AppDataFileService;
