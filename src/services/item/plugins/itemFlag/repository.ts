import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { itemFlags } from '../../../../drizzle/schema';
import { Account } from '../../../account/entities/account';

type CreateItemFlagBody = {
  flagType: FlagType;
  creator: Account;
  itemId: string;
};

@singleton()
export class ItemFlagRepository {
  async addOne(db: DBConnection, { flagType, creator, itemId }: CreateItemFlagBody) {
    return await db
      .insert(itemFlags)
      .values({ type: flagType, creatorId: creator.id, itemId })
      .returning();
  }
}
