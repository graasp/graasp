import { FlagType } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Account } from '../../../account/entities/account';
import { ItemFlag } from './itemFlag';

export const ItemFlagRepository = AppDataSource.getRepository(ItemFlag).extend({
  /**
   * Create ItemFlag.
   * @param itemFlag Partial ItemFlag object
   */
  async post(itemFlag: Partial<ItemFlag>, creator: Account, itemId: string): Promise<ItemFlag> {
    const entry = this.create({ ...itemFlag, creator, item: { id: itemId } });
    await this.insert(entry);
    return entry;
  },

  /**
   * Get all flags.
   */
  async getAllFlags(): Promise<FlagType[]> {
    return Object.values(FlagType);
  },
});
