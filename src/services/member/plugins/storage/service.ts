import { inject, singleton } from 'tsyringe';

import { FileItemType, MemberStorage, Pagination } from '@graasp/sdk';

import { FILE_ITEM_TYPE_DI_KEY } from '../../../../di/constants';
import { DBConnection } from '../../../../drizzle/db';
import { DEFAULT_MAX_STORAGE } from '../../../item/plugins/file/utils/constants';
import { StorageExceeded } from '../../../item/plugins/file/utils/errors';
import { ItemRepository } from '../../../item/repository';
import { Member } from '../../entities/member';

@singleton()
export class StorageService {
  private fileItemType: FileItemType;
  private readonly itemRepository: ItemRepository;

  constructor(
    @inject(FILE_ITEM_TYPE_DI_KEY) fileItemType: FileItemType,
    itemRepository: ItemRepository,
  ) {
    this.fileItemType = fileItemType;
    this.itemRepository = itemRepository;
  }

  async getMaximumStorageSize(_actor: Member): Promise<number> {
    // todo: depends on user/group
    return DEFAULT_MAX_STORAGE;
  }

  async getStorageLimits(
    db: DBConnection,
    actor: Member,
    type: FileItemType,
  ): Promise<MemberStorage> {
    return {
      current: await this.itemRepository.getItemSumSize(db, actor?.id, type),
      maximum: await this.getMaximumStorageSize(actor),
    };
  }

  async getStorageFilesMetadata(
    db: DBConnection,
    actor: Member,
    type: FileItemType,
    pagination: Pagination,
  ) {
    const { data, totalCount } = await this.itemRepository.getFilesMetadata(
      db,
      actor?.id,
      type,
      pagination,
    );
    return { data, totalCount };
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  // todo: include more item types
  async checkRemainingStorage(db: DBConnection, actor: Member, size: number = 0) {
    const { id: memberId } = actor;

    const currentStorage = await this.itemRepository.getItemSumSize(
      db,
      memberId,
      this.fileItemType,
    );

    const maxStorage = await this.getMaximumStorageSize(actor);
    if (currentStorage + size > maxStorage) {
      throw new StorageExceeded(currentStorage + size);
    }
  }
}
