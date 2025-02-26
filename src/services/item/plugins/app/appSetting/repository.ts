import { and, eq } from 'drizzle-orm';

import { FileItemType, ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { type AppSetting, appSettings } from '../../../../../drizzle/schema';
import { ItemNotFound } from '../../../../../utils/errors';
import { AppSettingNotFound, PreventUpdateAppSettingFile } from './errors';
import { InputAppSetting } from './interfaces/app-setting';

type CreateAppSettingBody = {
  itemId: string;
  memberId: string | undefined;
  appSetting: Partial<InputAppSetting>;
};
type UpdateAppSettingBody = Partial<AppSetting>;

export class AppSettingRepository {
  async addOne(
    db: DBConnection,
    { itemId, memberId, appSetting }: CreateAppSettingBody,
  ): Promise<AppSetting> {
    return await db.insert(appSettings).values({
      ...appSetting,
      itemId,
      creatorId: memberId,
    });
  }

  async updateOne(
    db: DBConnection,
    appSettingId: string,
    body: UpdateAppSettingBody,
  ): Promise<AppSetting> {
    // we shouldn't update file data
    const originalData = await db.query.appSettings.findFirst({
      where: eq(appSettings.id, appSettingId),
    });

    if (!originalData) {
      throw new AppSettingNotFound(appSettingId);
    }

    const dataType = originalData.data?.type as FileItemType;
    if ([ItemType.LOCAL_FILE, ItemType.S3_FILE].includes(dataType)) {
      throw new PreventUpdateAppSettingFile(originalData);
    }

    return await db.update(appSettings).set(body).where(eq(appSettings.id, appSettingId));
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

  async getForItem(db: DBConnection, itemId: string, name?: string): Promise<AppSetting[]> {
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
