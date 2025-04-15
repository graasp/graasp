import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { itemFlagsTable } from '../../../../drizzle/schema';

type CreateItemFlagBody = {
  flagType: FlagType;
  creatorId: string;
  itemId: string;
};

@singleton()
export class ItemFlagRepository {
  async addOne(
    dbConnection: DBConnection,
    { flagType, creatorId, itemId }: CreateItemFlagBody,
  ): Promise<void> {
    await dbConnection.insert(itemFlagsTable).values({ type: flagType, creatorId, itemId });
  }
}
