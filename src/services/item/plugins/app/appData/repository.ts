import { In } from 'typeorm';

import { ItemType, ResultOf, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { mapById } from '../../../../utils';
import { AppDataNotFound, PreventUpdateAppDataFile } from './errors';
import { AppData, Filters } from './appData';
import { InputAppData } from './interfaces/app-data';

export const AppDataRepository = AppDataSource.getRepository(AppData).extend({
  async post(itemId: string, memberId: string, body: Partial<InputAppData>): Promise<AppData> {
    const created = await this.insert({
      ...body,
      item: { id: itemId },
      member: { id: memberId },
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(created.identifiers[0].id);
  },

  async patch(itemId: string, appDataId: string, body: Partial<AppData>): Promise<AppData> {
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

  async deleteOne(itemId: string, appDataId: string): Promise<UUID> {
    const deleteResult = await this.delete(appDataId);

    if (!deleteResult.affected) {
      throw new AppDataNotFound(appDataId);
    }

    return appDataId;
  },

  async get(id: string): Promise<AppData> {
    const appData =await this.findOneBy({ id });

if(!appData) {
  throw new AppDataNotFound();
}

    return appData;
  },

  async getForItem(itemId: string, filters: Filters = {}): Promise<AppData[]> {
    return this.find({
      where: { item: { id: itemId }, ...filters },
      relations: { member: true, creator: true, item: true },
    });
  },

  async getForManyItems(itemIds: string[], filters: Filters = {}): Promise<ResultOf<AppData[]>> {
    const appDatas = await this.find({
      where: { item: { id: In(itemIds) }, ...filters },
      relations: { member: true, creator: true, item: true },
    });

    return mapById({
      keys: itemIds,
      findElement: (id) => appDatas.filter(({ itemId }) => itemId === id),
    });
  },
});
