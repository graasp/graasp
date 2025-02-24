import { Brackets, DeepPartial, EntityManager } from 'typeorm';

import { AppDataVisibility, FileItemType, ItemType, PermissionLevel } from '@graasp/sdk';

import { MutableRepository } from '../../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../../repositories/const';
import { Account } from '../../../../account/entities/account';
import { AppData, Filters } from './appData';
import { AppDataNotFound, PreventUpdateAppDataFile } from './errors';
import { InputAppData } from './interfaces/app-data';

type CreateAppDataBody = { appData: Partial<InputAppData>; itemId: string; actorId: Account['id'] };
type UpdateAppDataBody = DeepPartial<InputAppData>;

const RELATIONS = { account: true, creator: true, item: true };

export class AppDataRepository extends MutableRepository<AppData, UpdateAppDataBody> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, AppData, manager);
  }

  async addOne({ itemId, actorId, appData }: CreateAppDataBody): Promise<AppData> {
    return await super.insert({
      ...appData,
      item: { id: itemId },
      creator: { id: actorId },
      account: { id: appData.accountId ?? actorId },
    });
  }

  async updateOne(appDataId: string, body: UpdateAppDataBody): Promise<AppData> {
    // we shouldn't update file data
    const originalData = await super.findOne(appDataId);

    if (!originalData) {
      throw new AppDataNotFound(appDataId);
    }

    const dataType = originalData.data?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppDataFile(originalData.id);
    }

    return await super.updateOne(appDataId, body);
  }

  async getOne(id: string) {
    return await super.findOne(id, {
      relations: RELATIONS,
    });
  }

  async getForItem(
    itemId: string,
    filters: Filters = {},
    permission?: PermissionLevel,
  ): Promise<AppData[]> {
    const { accountId, type } = filters;

    const query = this.repository
      .createQueryBuilder('appData')
      .leftJoinAndSelect('appData.account', 'account')
      .leftJoinAndSelect('appData.creator', 'creator')
      .leftJoinAndSelect('appData.item', 'item')
      .where('item.id = :itemId', { itemId });

    // filter app data to only include requested type
    if (type) {
      query.andWhere('appData.type = :type', { type });
    }

    // restrict app data access if user is not an admin
    if (permission !== PermissionLevel.Admin) {
      query.andWhere(
        new Brackets((qb1) => {
          // - visibility: item
          qb1.where(`appData.visibility = :v1`, { v1: AppDataVisibility.Item });

          // - visibility: account & account: id
          // additionally get account's app data if defined
          if (accountId) {
            qb1.orWhere(
              new Brackets((qb2) => {
                qb2
                  .where(`appData.visibility = :v2`, { v2: AppDataVisibility.Member })
                  .andWhere('account.id = :accountId', { accountId });
              }),
            );
          }
        }),
      );
    }

    return await query.getMany();
  }
}
