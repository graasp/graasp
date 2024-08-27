import { EntityManager, FindOneOptions } from 'typeorm';

import { FlagType } from '@graasp/sdk';

import { ImmutableRepository } from '../../../../repositories/ImmutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { Account } from '../../../account/entities/account';
import { ItemFlag } from './itemFlag';

type CreateItemFlagBody = {
  flagType: FlagType;
  creator: Account;
  itemId: string;
};

export class ItemFlagRepository extends ImmutableRepository<ItemFlag> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ItemFlag, manager);
  }

  async getOne(
    id: string,
    options?: Pick<FindOneOptions<ItemFlag>, 'withDeleted'>,
  ): Promise<ItemFlag | null> {
    return await super.findOne(id, { relations: { creator: true, item: true }, ...options });
  }

  async addOne({ flagType, creator, itemId }: CreateItemFlagBody): Promise<ItemFlag> {
    return await super.insert({ type: flagType, creator, item: { id: itemId } });
  }
}
