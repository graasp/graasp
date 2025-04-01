import { and, eq } from 'drizzle-orm';

import { FileItemType, ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { appSettings } from '../../../../../drizzle/schema';
import { AppSettingInsertDTO, AppSettingRaw } from '../../../../../drizzle/types';
import { ItemNotFound } from '../../../../../utils/errors';
import { AppSettingNotFound, PreventUpdateAppSettingFile } from './errors';

type UpdateAppSettingBody = Partial<AppSettingRaw>;

export class AppSettingRepository {
  async addOne(db: DBConnection, appSetting: AppSettingInsertDTO): Promise<AppSettingRaw> {
    const res = await db.insert(appSettings).values(appSetting).returning();
    return res[0];
  }

  async updateOne(
    db: DBConnection,
    appSettingId: string,
    body: UpdateAppSettingBody,
  ): Promise<AppSettingRaw> {
    // we shouldn't update file data
    const originalData = await db.query.appSettings.findFirst({
      where: eq(appSettings.id, appSettingId),
    });

    if (!originalData) {
      throw new AppSettingNotFound(appSettingId);
    }

    // parsing very unsecurely ...
    const appSettingData = originalData.data as { type: string };
    const dataType = appSettingData?.type as FileItemType;

    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppSettingFile(originalData);
    }

    const res = await db
      .update(appSettings)
      .set(body)
      .where(eq(appSettings.id, appSettingId))
      .returning();
    return res[0];
  }

  async deleteOne(db: DBConnection, appSettingId: string) {
    await db.delete(appSettings).where(eq(appSettings.id, appSettingId)).returning();
  }

  async getOne(db: DBConnection, id: string) {
    return await db.query.appSettings.findFirst({
      where: eq(appSettings.id, id),
      with: { creator: true, item: true },
    });
  }

  async getOneOrThrow(db: DBConnection, id: string) {
    const data = await this.getOne(db, id);
    if (!data) {
      throw new AppSettingNotFound(id);
    }
    return data;
  }

  async getForItem(db: DBConnection, itemId: string, name?: string): Promise<AppSettingRaw[]> {
    if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    const whereConditions = [eq(appSettings.itemId, itemId)];
    if (name) {
      whereConditions.push(eq(appSettings.name, name));
    }

    return await db.query.appSettings.findMany({
      where: and(...whereConditions),
      with: { creator: true, item: true },
    });
  }
}
