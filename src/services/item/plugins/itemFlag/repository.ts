import { FlagType } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource.js';
import { Member } from '../../../member/entities/member.js';
import { ItemFlag } from './itemFlag.js';

export const ItemFlagRepository = AppDataSource.getRepository(ItemFlag).extend({
  /**
   * Create ItemFlag.
   * @param itemFlag Partial ItemFlag object
   */
  async post(itemFlag: Partial<ItemFlag>, creator: Member, itemId: string): Promise<ItemFlag> {
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
