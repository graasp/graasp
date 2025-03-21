import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { itemFlags } from '../../../../drizzle/schema';
import { FlagOptionsType } from './itemFlag.types';

type CreateItemFlagBody = {
  flagType: FlagOptionsType;
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
