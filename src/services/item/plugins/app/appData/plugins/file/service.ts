import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { SavedMultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../../../../util/graasp-error';
import { Repositories } from '../../../../../../../util/repositories';
import { validatePermission } from '../../../../../../authorization';
import FileService from '../../../../../../file/service';
import { Actor } from '../../../../../../member/entities/member';
import ItemService from '../../../../../service';
import { AppDataVisibility } from '../../../interfaces/app-details';
import { APP_DATA_TYPE_FILE } from '../../../util/constants';
import { AppData } from '../../appData';
import { AppDataService } from '../../service';

class AppDataFileService {
  appDataService: AppDataService;
  fileService: FileService;
  itemService: ItemService;

  buildFilePath(itemId: UUID, appDataId: UUID) {
    return path.join('app-data', itemId, appDataId);
  }

  constructor(appDataService: AppDataService, fileService: FileService, itemService: ItemService) {
    this.appDataService = appDataService;
    this.fileService = fileService;
    this.itemService = itemService;
  }

  async upload(
    actor: Actor,
    repositories: Repositories,
    fileObject: Partial<SavedMultipartFile> &
      Pick<SavedMultipartFile, 'filename' | 'mimetype' | 'filepath'>,
    itemId: string,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // TODO: check rights
    if (itemId) {
      const item = await repositories.itemRepository.get(itemId);
      // posting an app data is allowed to readers
      await validatePermission(repositories, PermissionLevel.Read, actor, item);
    }

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
      .upload(actor, {
        file,
        filepath,
        mimetype,
        size,
      })
      .then(() => {
        return { filepath, filename, size, mimetype };
      })
      .catch((e) => {
        throw e;
      });

    // remove undefined values
    // const values = { ...fileBody };
    // Object.keys(values).forEach((key) => values[key] === undefined && delete values[key]);

    // const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);

    const appData = await repositories.appDataRepository.post(itemId, actor.id, {
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
    actor,
    repositories: Repositories,
    {
      reply,
      itemId,
      appDataId,
      replyUrl,
    }: { reply: FastifyReply; itemId: UUID; appDataId: UUID; replyUrl?: boolean },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    await this.itemService.get(actor, repositories, itemId);
    const appData = await this.appDataService.get(actor, repositories, itemId, appDataId);
    const result = await this.fileService.download(actor, {
      reply: replyUrl ? undefined : reply,
      id: appData.id,
      replyUrl,
      ...appData.data,
    });

    return result;
  }

  async deleteOne(actor, repositories: Repositories, appData: AppData) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      if (!appData?.data?.[this.fileService.type]) {
        return;
      }

      const filepath = appData.data[this.fileService.type].filepath;
      await this.fileService.delete(actor, { filepath });
    } catch (err) {
      // we catch the error, it ensures the item is deleted even if the file is not
      // this is especially useful for the files uploaded before the migration to the new plugin
      console.error(err);
    }
  }
}

export default AppDataFileService;
