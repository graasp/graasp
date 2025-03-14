import { db } from '../../../../../../drizzle/db.js';
import { appSettings } from '../../../../../../drizzle/schema.js';
import { Item } from '../../../../../../drizzle/types.js';
import { MinimalMember } from '../../../../../../types.js';

export const saveAppSettings = async ({
  item,
  creator,
}: {
  item: Item;
  creator: MinimalMember;
}) => {
  const defaultData = { name: 'setting-name', data: { setting: 'value' } };
  return await db
    .insert(appSettings)
    .values([
      { itemId: item.id, creatorId: creator.id, ...defaultData },
      { itemId: item.id, creatorId: creator.id, ...defaultData },
      { itemId: item.id, creatorId: creator.id, ...defaultData },
      { itemId: item.id, creatorId: creator.id, ...defaultData, name: 'new-setting' },
    ])
    .returning();
};
