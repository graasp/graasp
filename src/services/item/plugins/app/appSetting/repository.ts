import { EntityManager } from 'typeorm';

import { FileItemType, ItemType } from '@graasp/sdk';

import { MutableRepository } from '../../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../../repositories/const';
import { ItemNotFound } from '../../../../../utils/errors';
import { AppSetting } from './appSettings';
import { AppSettingNotFound, PreventUpdateAppSettingFile } from './errors';
import { InputAppSetting } from './interfaces/app-setting';

type CreateAppSettingBody = {
  itemId: string;
  memberId: string | undefined;
  appSetting: Partial<InputAppSetting>;
};
type UpdateAppSettingBody = Partial<AppSetting>;

export class AppSettingRepository extends MutableRepository<AppSetting, UpdateAppSettingBody> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, AppSetting, manager);
  }

  async addOne({ itemId, memberId, appSetting }: CreateAppSettingBody): Promise<AppSetting> {
    return await super.insert({
      ...appSetting,
      item: { id: itemId },
      creator: { id: memberId },
    });
  }

  async updateOne(appSettingId: string, body: UpdateAppSettingBody): Promise<AppSetting> {
    // we shouldn't update file data
    const originalData = await super.findOne(appSettingId);

    if (!originalData) {
      throw new AppSettingNotFound(appSettingId);
    }

    const dataType = originalData.data?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppSettingFile(originalData);
    }

    return await super.updateOne(appSettingId, body);
  }

  async getOne(id: string) {
    return await super.findOne(id, { relations: { creator: true, item: true } });
  }

  async getOneOrThrow(id: string) {
    return await super.getOneOrThrow(id, undefined, new AppSettingNotFound(id));
  }

  async getForItem(itemId: string, name?: string): Promise<AppSetting[]> {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }
    return await this.repository.find({
      where: {
        item: { id: itemId },
        ...(name ? { name } : undefined),
      },
      relations: { creator: true, item: true },
    });
  }
}
