import { SQL } from 'drizzle-orm';
import { and, eq, or } from 'drizzle-orm/sql';

import {
  AppDataVisibility,
  FileItemType,
  ItemType,
  PermissionLevel,
  PermissionLevelOptions,
} from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { appDataTable } from '../../../../../drizzle/schema';
import {
  Account,
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
    dbConnection: DBConnection,
    { itemId, actorId, appData }: CreateAppDataBody,
  ): Promise<AppDataRaw> {
    const savedValue = await dbConnection
      .insert(appDataTable)
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

  async updateOne(
    dbConnection: DBConnection,
    appDataId: string,
    body: Partial<AppDataRaw>,
  ): Promise<AppDataRaw> {
    // we shouldn't update file data
    const originalData = await dbConnection.query.appDataTable.findFirst({
      where: eq(appDataTable.id, appDataId),
    });

    if (!originalData) {
      throw new AppDataNotFound(appDataId);
    }

    const dataType = originalData?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppDataFile(originalData.id);
    }

    const patchedAppData = await dbConnection
      .update(appDataTable)
      .set(body)
      .where(eq(appDataTable.id, appDataId))
      .returning();

    return patchedAppData[0];
  }

  async getOne(
    dbConnection: DBConnection,
    id: string,
  ): Promise<AppDataWithItemAndAccountAndCreator | undefined> {
    return await dbConnection.query.appDataTable.findFirst({
      where: eq(appDataTable.id, id),
      with: { account: true, creator: true, item: true },
    });
  }

  async getForItem(
    dbConnection: DBConnection,
    itemId: string,
    filters: {
      visibility?: AppDataVisibility;
      accountId?: Account['id'];
      type?: string;
    } = {},
    permission?: PermissionLevelOptions,
  ): Promise<AppDataWithItemAndAccountAndCreator[]> {
    const { accountId, type } = filters;

    const andConditions: (SQL | undefined)[] = [eq(appDataTable.itemId, itemId)];

    // filter app data to only include requested type
    if (type) {
      andConditions.push(eq(appDataTable.type, type));
    }

    // restrict app data access if user is not an admin
    if (permission !== PermissionLevel.Admin) {
      const orConditions: (SQL | undefined)[] = [
        // - visibility: item
        eq(appDataTable.visibility, AppDataVisibility.Item),
      ];

      if (accountId) {
        orConditions.push(
          // - visibility: account & account: id
          // additionally get account's app data if defined
          and(
            eq(appDataTable.visibility, AppDataVisibility.Member),
            eq(appDataTable.accountId, accountId),
          ),
        );
      }
      andConditions.push(or(...orConditions));
    }

    return await dbConnection.query.appDataTable.findMany({
      where: and(...andConditions),
      with: {
        creator: true,
        account: true,
        item: true,
      },
    });
  }

  async deleteOne(dbConnection: DBConnection, id: string): Promise<void> {
    await dbConnection.delete(appDataTable).where(eq(appDataTable.id, id));
  }
}
