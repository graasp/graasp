import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { itemFlags } from '../../../../drizzle/schema';

type CreateItemFlagBody = {
  flagType: FlagType;
  creatorId: string;
  itemId: string;
};

@singleton()
export class ItemFlagRepository {
  async addOne(
    db: DBConnection,
    { flagType, creatorId, itemId }: CreateItemFlagBody,
  ): Promise<void> {
    await db.insert(itemFlags).values({ type: flagType, creatorId, itemId });
  }
}
