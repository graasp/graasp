import { Brackets } from 'typeorm';

import { AppDataVisibility, ItemType, PermissionLevel, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { AppData, Filters } from './appData';
import { AppDataNotFound, PreventUpdateAppDataFile } from './errors';
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
      throw new PreventUpdateAppDataFile(originalData.id);
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
    const appData = await this.findOne({
      where: { id },
      relations: { member: true, creator: true, item: true },
    });

    if (!appData) {
      throw new AppDataNotFound();
    }

    return appData;
  },

  async getForItem(
    itemId: string,
    filters: Filters = {},
    permission?: PermissionLevel,
  ): Promise<AppData[]> {
    const { memberId } = filters;

    const query = this.createQueryBuilder('appData')
      .leftJoinAndSelect('appData.member', 'member')
      .leftJoinAndSelect('appData.creator', 'creator')
      .leftJoinAndSelect('appData.item', 'item')
      .where('item.id = :itemId', { itemId });

    // restrict app data access if user is not an admin
    if (permission !== PermissionLevel.Admin) {
      query.andWhere(
        new Brackets((qb1) => {
          // - visibility: item
          qb1.where(`appData.visibility = :v1`, { v1: AppDataVisibility.Item });

          // - visibility: member & member: id
          // additionally get member's app data if defined
          if (memberId) {
            qb1.orWhere(
              new Brackets((qb2) => {
                qb2
                  .where(`appData.visibility = :v2`, { v2: AppDataVisibility.Member })
                  .andWhere('member.id = :memberId', { memberId });
              }),
            );
          }
        }),
      );
    }

    return query.getMany();
  },
});
