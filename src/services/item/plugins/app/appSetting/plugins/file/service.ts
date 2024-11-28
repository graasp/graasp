import path from 'path';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import { MultipartFile } from '@fastify/multipart';

import { FileItemProperties, MAX_ITEM_NAME_LENGTH, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../../../../utils/repositories';
import { Account } from '../../../../../../account/entities/account';
import FileService from '../../../../../../file/service';
import { Member } from '../../../../../../member/entities/member';
import { Item } from '../../../../../entities/Item';
import { ItemService } from '../../../../../service';
import { AppSetting } from '../../appSettings';
import { NotAppSettingFile } from '../../errors';
import { AppSettingService } from '../../service';

type AppSettingFileProperties = {
  path: string;
  name: string;
  mimetype: string;
};

@singleton()
class AppSettingFileService {
  private readonly appSettingService: AppSettingService;
  private readonly fileService: FileService;
  private readonly itemService: ItemService;

  buildFilePath(itemId: UUID, appSettingId: UUID) {
    return path.join('apps', 'app-setting', itemId, appSettingId);
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

  async upload(member: Account, repositories: Repositories, file: MultipartFile, item: Item) {
    const { filename, mimetype, fields, file: stream } = file;
    const appSettingId = v4();
    const filepath = this.buildFilePath(item.id, appSettingId); // parentId, filename

    // compute body data from file's fields
    let name = 'file';
    if (fields) {
      const fileBody = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          (fields[key] as unknown as { value: string })?.value,
        ]),
      );
      name = fileBody?.name?.substring(0, MAX_ITEM_NAME_LENGTH) ?? 'file';
    }

    const fileProperties = (await this.fileService
      .upload(member, {
        file: stream,
        filepath,
        mimetype,
      })
      .then(() => {
        return { path: filepath, name: filename, mimetype };
      })
      .catch((e) => {
        throw e;
      })) satisfies AppSettingFileProperties;

    const appSetting = await repositories.appSettingRepository.addOne({
      itemId: item.id,
      memberId: member.id,
      appSetting: {
        id: appSettingId,
        name,
        data: {
          [this.fileService.fileType]: fileProperties,
        },
      },
    });

    return appSetting;
  }

  async download(
    account: Account,
    repositories: Repositories,
    { item, appSettingId }: { item: Item; appSettingId: UUID },
  ) {
    // get app setting and check it is a file
    const appSetting = await this.appSettingService.get(
      account,
      repositories,
      item.id,
      appSettingId,
    );
    const fileProp = appSetting.data[this.fileService.fileType] as AppSettingFileProperties;
    if (!fileProp) {
      throw new NotAppSettingFile(appSetting);
    }

    // always return the url because redirection uses bearer token automatically
    // and s3 prevent multiple auth methods
    const result = await this.fileService.getUrl({
      path: fileProp.path,
    });

    return result;
  }

  async copyMany(actor: Member, repositories: Repositories, toCopy: AppSetting[]) {
    const fileItemType = this.fileService.fileType;
    for (const appSetting of toCopy) {
      if (!appSetting.data) {
        throw new Error('App setting file is not correctly defined');
      }

      // create file data object
      const itemId = appSetting.item.id;
      const newFilePath = this.buildFilePath(itemId, appSetting.id);
      const originalFileExtra = appSetting.data[fileItemType] as AppSettingFileProperties;
      const newFileData = {
        [fileItemType]: {
          path: newFilePath,
          name: originalFileExtra.name,
          mimetype: originalFileExtra.mimetype,
        } satisfies AppSettingFileProperties,
      };

      // run copy task
      await this.fileService.copy(actor, {
        newId: appSetting.id,
        newFilePath,
        originalPath: originalFileExtra.path,
        mimetype: originalFileExtra.mimetype,
      });

      // update new setting with file data
      await repositories.appSettingRepository.updateOne(appSetting.id, { data: newFileData });
    }
  }

  async deleteOne(actor, repositories: Repositories, appSetting: AppSetting) {
    // TODO: check rights? but only use in posthook
    try {
      // delete file only if type is the current file type
      const fileProp = appSetting?.data?.[this.fileService.fileType] as FileItemProperties;
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

export default AppSettingFileService;
