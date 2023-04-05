import { In } from 'typeorm';

import { ItemType } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { mapById } from '../../../../utils';
import { AppDataNotFound, PreventUpdateAppDataFile } from '../util/graasp-apps-error';
import { AppData } from './appData';
import { InputAppData } from './interfaces/app-data';

export const AppDataRepository = AppDataSource.getRepository(AppData).extend({
  async post(itemId: string, memberId: string, body: Partial<InputAppData>) {
    const created = await this.insert({
      ...body,
      item: { id: itemId },
      member: { id: memberId },
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(created.identifiers[0].id);
  },

  async patch(itemId: string, appDataId: string, body: Partial<AppData>) {
    // shouldn't update file data
    // TODO: optimize and refactor
    const originalData = await this.get(appDataId);
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(originalData?.data?.type)) {
      throw new PreventUpdateAppDataFile(originalData);
    }

    await this.update({ id: appDataId, item: { id: itemId } }, body);

    // TODO: optimize
    return this.get(appDataId);
  },

  async deleteOne(itemId: string, appDataId: string) {
    const deleteResult = await this.delete(appDataId);

    if (!deleteResult.affected) {
      throw new AppDataNotFound(appDataId);
    }

    return appDataId;
  },

  async get(id: string) {
    return this.findOneBy({ id });
  },

  getForItem(itemId: string, filters: Partial<AppData> = {}) {
    return this.findBy({ item: { id: itemId }, ...filters });
  },

  async getForManyItems(itemIds: string[], filters: Partial<AppData> = {}) {
    const appDatas = await this.findBy({ item: { id: In(itemIds) }, ...filters });

    return mapById({
      keys: itemIds,
      findElement: (id) => appDatas.filter(({ itemId }) => itemId === id),
    });
  },
});
