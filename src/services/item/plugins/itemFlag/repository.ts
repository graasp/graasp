import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { ItemFlagCreationDTO, itemFlags } from '../../../../drizzle/schema';
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
  ): Promise<ItemFlagCreationDTO> {
    return await db.insert(itemFlags).values({ type: flagType, creatorId, itemId }).returning();
  }
}
