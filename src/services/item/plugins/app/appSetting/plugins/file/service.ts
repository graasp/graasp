import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { SavedMultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import { UUID } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../../../../util/graasp-error';
import { Repositories } from '../../../../../../../util/repositories';
import FileService from '../../../../../../file/service';
import { Actor } from '../../../../../../member/entities/member';
import ItemService from '../../../../../service';
import { AppSetting } from '../../appSettings';
import { AppSettingService } from '../../service';

const ORIGINAL_FILENAME_TRUNCATE_LIMIT = 20;

class AppSettingFileService {
  appSettingService: AppSettingService;
  fileService: FileService;
  itemService: ItemService;

  buildFilePath(itemId: UUID, appSettingId: UUID) {
    return path.join('app-setting', itemId, appSettingId);
  }

  constructor(
    appSettingService: AppSettingService,
    fileService: FileService,
    itemService: ItemService,
  ) {
    this.appSettingService = appSettingService;
    this.fileService = fileService;
    this.itemService = itemService;
  }

  async upload(
    actorId: string | undefined,
    repositories: Repositories,
    fileObject: Partial<SavedMultipartFile> &
      Pick<SavedMultipartFile, 'filename' | 'mimetype' | 'filepath'>,
    itemId: string,
  ) {
    const { memberRepository } = repositories;

    if (!actorId) {
      throw new UnauthorizedMember(actorId);
    }
    const member = await memberRepository.get(actorId);

    // posting an app data is allowed to readers
    const item = await this.itemService.get(member, repositories, itemId);

    const { filename, mimetype, fields, filepath: tmpPath } = fileObject;
    const file = fs.createReadStream(tmpPath);
    const { size } = fs.statSync(tmpPath);
    const appSettingId = v4();
    const filepath = this.buildFilePath(itemId, appSettingId); // parentId, filename

    // TODO: CHECK that it is working
    // compute body data from file's fields
    let name = 'file';
    if (fields) {
      const fileBody = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          (fields[key] as unknown as { value: string })?.value,
        ]),
      );
      name = fileBody?.name?.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT) ?? 'file';
    }
    // TODO: REMOVE???
    // remove undefined values
    // const values = { ...fileBody };
    // Object.keys(values).forEach((key) => values[key] === undefined && delete values[key]);

    // const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);

    const fileProperties = await this.fileService
      .upload(member, {
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

    const appSetting = await repositories.appSettingRepository.post(itemId, actorId, {
      id: appSettingId,
      name,
      data: {
        [this.fileService.type]: fileProperties,
      },
    });

    return appSetting;
  }

  async download(
    actor,
    repositories: Repositories,
    {
      reply,
      itemId,
      appSettingId,
      replyUrl,
    }: { reply: FastifyReply; itemId: UUID; appSettingId: UUID; replyUrl?: boolean },
  ) {
    // check rights
    await this.itemService.get(actor, repositories, itemId);
    const appSetting = await this.appSettingService.get(actor, repositories, itemId, appSettingId);
    const result = await this.fileService.download(actor, {
      reply: replyUrl ? undefined : reply,
      id: appSetting.id,
      replyUrl,
      ...appSetting.data,
    });

    return result;
  }

  async copyMany(actor: Actor, repositories: Repositories, toCopy: AppSetting[]) {
    const fileItemType = this.fileService.type;
    for (const appS of toCopy) {
      if (!appS.data) {
        throw new Error('App setting file is not correctly defined');
      }

      // create file data object
      const itemId = appS.item.id;
      const newFilePath = this.buildFilePath(itemId, appS.id);
      const newFileData = {
        [fileItemType]: {
          filepath: newFilePath,
          filename: appS.data[fileItemType].name,
          size: appS.data[fileItemType].size,
          mimetype: appS.data[fileItemType].mimetype,
        },
      };

      // run copy task
      const originalFileExtra = appS.data[fileItemType];
      await this.fileService.copy(actor, {
        newId: appS.id,
        newFilePath,
        originalPath: originalFileExtra.path,
        mimetype: originalFileExtra.mimetype,
      });

      // update new setting with file data
      await repositories.appSettingRepository.patch(itemId, appS.id, { data: newFileData });
    }
  }

  async deleteOne(actor, repositories: Repositories, appSetting: AppSetting) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      if (!appSetting?.data?.[this.fileService.type]) {
        return;
      }

      const filepath = appSetting.data[this.fileService.type].filepath;
      await this.fileService.delete(actor, { filepath });
    } catch (err) {
      // we catch the error, it ensures the item is deleted even if the file is not
      // this is especially useful for the files uploaded before the migration to the new plugin
      console.error(err);
    }
  }
}

export default AppSettingFileService;
