import { ItemType } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { AppSetting } from './appSettings';
import { AppSettingNotFound, PreventUpdateAppSettingFile } from './errors';
import { InputAppSetting } from './interfaces/app-setting';

export const AppSettingRepository = AppDataSource.getRepository(AppSetting).extend({
  async post(itemId: string, memberId: string, body: Partial<InputAppSetting>) {
    const appSetting = await this.insert({
      ...body,
      item: { id: itemId },
      member: { id: memberId },
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(appSetting.identifiers[0].id);
  },

  async patch(itemId: string, appSettingId: string, body: Partial<AppSetting>) {
    // shouldn't update file data
    // TODO: optimize and refactor
    const originalData = await this.get(appSettingId);
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(originalData?.data?.type)) {
      throw new PreventUpdateAppSettingFile(originalData);
    }

    await this.update({ id: appSettingId, item: { id: itemId } }, body);

    // TODO: optimize
    return this.get(appSettingId);
  },

  async deleteOne(itemId: string, appSettingId: string) {
    const deleteResult = await this.delete(appSettingId);

    if (!deleteResult.affected) {
      throw new AppSettingNotFound(appSettingId);
    }

    return appSettingId;
  },

  async get(id: string) {
    return this.findOneBy({ id });
  },

  getForItem(itemId: string) {
    return this.findBy({ item: { id: itemId } });
  },
});
