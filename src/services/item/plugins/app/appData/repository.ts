import { and, eq, or } from 'drizzle-orm/sql';

import { AppDataVisibility, FileItemType, ItemType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { AppDataInsertRaw, appDatas } from '../../../../../drizzle/schema';
import { Account } from '../../../../account/entities/account';
import { AppData, Filters } from './appData';
import { AppDataNotFound, PreventUpdateAppDataFile } from './errors';
import { InputAppData } from './interfaces/app-data';

type CreateAppDataBody = { appData: Partial<InputAppData>; itemId: string; actorId: Account['id'] };

const RELATIONS = { account: true, creator: true, item: true };

export class AppDataRepository {
  async addOne(
    db: DBConnection,
    { itemId, actorId, appData }: CreateAppDataBody,
  ): Promise<AppData> {
    return await db
      .insert(appDatas)
      .values({
        ...appData,
        item: { id: itemId },
        creator: { id: actorId },
        account: { id: appData.accountId ?? actorId },
      })
      .returning();
  }

  async updateOne(db: DBConnection, appDataId: string, body: AppDataInsertRaw): Promise<AppData> {
    // we shouldn't update file data
    const originalData = await db.query.appDatas.findFirst({ where: eq(appDatas.id, appDataId) });

    if (!originalData) {
      throw new AppDataNotFound(appDataId);
    }

    const dataType = originalData.data?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppDataFile(originalData.id);
    }

    return await db.update(appDatas).set(body).where(eq(appDatas.id, appDataId));
  }

  async getOne(db: DBConnection, id: string) {
    return await db.query.appDatas.findFirst({
      where: eq(appDatas.id, id),
      with: RELATIONS,
    });
  }

  async getForItem(
    db: DBConnection,
    itemId: string,
    filters: Filters = {},
    permission?: PermissionLevel,
  ): Promise<AppData[]> {
    const { accountId, type } = filters;

    const andConditions = [eq(appDatas.itemId, itemId)];

    // filter app data to only include requested type
    if (type) {
      andConditions.push(eq(appDatas.type, type));
    }

    // restrict app data access if user is not an admin
    if (permission !== PermissionLevel.Admin) {
      const orConditions = [
        // - visibility: item
        eq(appDatas.visibility, AppDataVisibility.Item),
      ];

      if (accountId) {
        orConditions.push(
          // - visibility: account & account: id
          // additionally get account's app data if defined
          and(eq(appDatas.visibility, AppDataVisibility.Member), eq(appDatas.accountId, accountId)),
        );
      }
      andConditions.push(or(...orConditions));
    }

    return await db.query.appDatas.findMany({
      where: and(...andConditions),
      with: {
        creator: true,
        account: true,
        item: true,
      },
    });
  }
}
