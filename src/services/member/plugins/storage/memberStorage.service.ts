import { singleton } from 'tsyringe';

import type { MemberStorage, Pagination } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { MinimalMember } from '../../../../types';
import { ItemRepository } from '../../../item/item.repository';
import { DEFAULT_MAX_STORAGE } from '../../../item/plugins/file/utils/constants';
import { StorageExceeded } from '../../../item/plugins/file/utils/errors';

@singleton()
export class StorageService {
  private readonly itemRepository: ItemRepository;

  constructor(itemRepository: ItemRepository) {
    this.itemRepository = itemRepository;
  }

  async getMaximumStorageSize(): Promise<number> {
    // todo: depends on user/group
    return DEFAULT_MAX_STORAGE;
  }

  async getStorageLimits(
    dbConnection: DBConnection,
    member: MinimalMember,
  ): Promise<MemberStorage> {
    return {
      current: await this.itemRepository.getItemSumSize(dbConnection, member?.id),
      maximum: await this.getMaximumStorageSize(),
    };
  }

  async getStorageFilesMetadata(
    dbConnection: DBConnection,
    member: MinimalMember,
    pagination: Pagination,
  ) {
    const entities = await this.itemRepository.getFilesMetadata(
      dbConnection,
      member?.id,
      pagination,
    );
    return entities;
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  // todo: include more item types
  async checkRemainingStorage(dbConnection: DBConnection, member: MinimalMember, size: number = 0) {
    const { id: memberId } = member;

    const currentStorage = await this.itemRepository.getItemSumSize(dbConnection, memberId);

    const maxStorage = await this.getMaximumStorageSize();
    if (currentStorage + size > maxStorage) {
      throw new StorageExceeded(currentStorage + size);
    }
  }
}
