import { and, eq } from 'drizzle-orm';

import { type DBConnection } from '../../../../../drizzle/db';
import { appSettingsTable } from '../../../../../drizzle/schema';
import type { AppSettingInsertDTO, AppSettingRaw } from '../../../../../drizzle/types';
import { ItemNotFound } from '../../../../../utils/errors';
import { AppSettingNotFound, PreventUpdateAppSettingFile } from './errors';

type UpdateAppSettingBody = Partial<AppSettingRaw>;

export class AppSettingRepository {
  async addOne(
    dbConnection: DBConnection,
    appSetting: AppSettingInsertDTO,
  ): Promise<AppSettingRaw> {
    const res = await dbConnection.insert(appSettingsTable).values(appSetting).returning();
    return res[0];
  }

  async createMany(dbConnection: DBConnection, appSettings: AppSettingInsertDTO[]): Promise<void> {
    await dbConnection.insert(appSettingsTable).values(appSettings);
  }

  async updateOne(
    dbConnection: DBConnection,
    appSettingId: string,
    body: UpdateAppSettingBody,
  ): Promise<AppSettingRaw> {
    // we shouldn't update file data
    const originalData = await dbConnection.query.appSettingsTable.findFirst({
      where: eq(appSettingsTable.id, appSettingId),
    });

    if (!originalData) {
      throw new AppSettingNotFound(appSettingId);
    }

    // parsing very unsecurely ...
    const appSettingData = originalData.data as { type: string };
    const dataType = appSettingData?.type;

    if ('file' === dataType) {
      throw new PreventUpdateAppSettingFile(originalData);
    }

    const res = await dbConnection
      .update(appSettingsTable)
      .set(body)
      .where(eq(appSettingsTable.id, appSettingId))
      .returning();
    return res[0];
  }

  async deleteOne(dbConnection: DBConnection, appSettingId: string) {
    await dbConnection
      .delete(appSettingsTable)
      .where(eq(appSettingsTable.id, appSettingId))
      .returning();
  }

  async getOne(dbConnection: DBConnection, id: string) {
    return await dbConnection.query.appSettingsTable.findFirst({
      where: eq(appSettingsTable.id, id),
      with: { creator: true, item: true },
    });
  }

  async getOneOrThrow(dbConnection: DBConnection, id: string) {
    const data = await this.getOne(dbConnection, id);
    if (!data) {
      throw new AppSettingNotFound(id);
    }
    return data;
  }

  async getForItem(
    dbConnection: DBConnection,
    itemId: string,
    name?: string,
  ): Promise<AppSettingRaw[]> {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    const whereConditions = [eq(appSettingsTable.itemId, itemId)];
    if (name) {
      whereConditions.push(eq(appSettingsTable.name, name));
    }

    return await dbConnection.query.appSettingsTable.findMany({
      where: and(...whereConditions),
      with: { creator: true, item: true },
    });
  }
}
