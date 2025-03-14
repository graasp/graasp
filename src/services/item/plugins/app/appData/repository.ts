import { SQL } from 'drizzle-orm';
import { and, eq, or } from 'drizzle-orm/sql';

import { AppDataVisibility, FileItemType, ItemType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { appDatas } from '../../../../../drizzle/schema';
import {
  Account,
  AppDataInsertDTO,
  AppDataRaw,
  AppDataWithItemAndAccountAndCreator,
} from '../../../../../drizzle/types';
import { AppDataNotFound, PreventUpdateAppDataFile } from './errors';
import { InputAppData } from './interfaces/app-data';

// TODO: appData was previously Partial, define what is needed all the time:
// -- type
type CreateAppDataBody = { appData: InputAppData; itemId: string; actorId: Account['id'] };

export class AppDataRepository {
  async addOne(
    db: DBConnection,
    { itemId, actorId, appData }: CreateAppDataBody,
  ): Promise<AppDataInsertDTO> {
    const savedValue = await db
      .insert(appDatas)
      .values({
        visibility: AppDataVisibility.Member,
        ...appData,
        itemId,
        creatorId: actorId,
        accountId: appData.accountId ?? actorId,
      })
      .returning();

    return savedValue[0];
  }

  async updateOne(db: DBConnection, appDataId: string, body: Partial<AppDataRaw>): Promise<void> {
    // we shouldn't update file data
    const originalData = await db.query.appDatas.findFirst({ where: eq(appDatas.id, appDataId) });

    if (!originalData) {
      throw new AppDataNotFound(appDataId);
    }

    const dataType = originalData?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppDataFile(originalData.id);
    }

    await db.update(appDatas).set(body).where(eq(appDatas.id, appDataId));
  }

  async getOne(
    db: DBConnection,
    id: string,
  ): Promise<AppDataWithItemAndAccountAndCreator | undefined> {
    return await db.query.appDatas.findFirst({
      where: eq(appDatas.id, id),
      with: { account: true, creator: true, item: true },
    });
  }

  async getForItem(
    db: DBConnection,
    itemId: string,
    filters: {
      visibility?: AppDataVisibility;
      accountId?: Account['id'];
      type?: string;
    } = {},
    permission?: `${PermissionLevel}`,
  ): Promise<AppDataWithItemAndAccountAndCreator[]> {
    const { accountId, type } = filters;

    const andConditions: (SQL | undefined)[] = [eq(appDatas.itemId, itemId)];

    // filter app data to only include requested type
    if (type) {
      andConditions.push(eq(appDatas.type, type));
    }

    // restrict app data access if user is not an admin
    if (permission !== PermissionLevel.Admin) {
      const orConditions: (SQL | undefined)[] = [
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

  async deleteOne(db: DBConnection, id: string): Promise<void> {
    await db.delete(appDatas).where(eq(appDatas.id, id));
  }
}
