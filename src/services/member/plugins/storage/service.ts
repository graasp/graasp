import { singleton } from 'tsyringe';

import { MemberStorage, Pagination } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { DEFAULT_MAX_STORAGE } from '../../../item/plugins/file/utils/constants';
import { StorageExceeded } from '../../../item/plugins/file/utils/errors';
import { Member } from '../../entities/member';

@singleton()
export class StorageService {
  async getMaximumStorageSize(_actor: Member): Promise<number> {
    // todo: depends on user/group
    return DEFAULT_MAX_STORAGE;
  }

  async getStorageLimits(actor: Member, { itemRepository }: Repositories): Promise<MemberStorage> {
    return {
      current: await itemRepository.getItemSumSize(actor?.id),
      maximum: await this.getMaximumStorageSize(actor),
    };
  }

  async getStorageFilesMetadata(
    actor: Member,
    { itemRepository }: Repositories,
    pagination: Pagination,
  ) {
    const { data, totalCount } = await itemRepository.getFilesMetadata(actor?.id, pagination);
    return { data, totalCount };
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  // todo: include more item types
  async checkRemainingStorage(actor: Member, repositories: Repositories, size: number = 0) {
    const { id: memberId } = actor;

    const currentStorage = await repositories.itemRepository.getItemSumSize(memberId);

    const maxStorage = await this.getMaximumStorageSize(actor);
    if (currentStorage + size > maxStorage) {
      throw new StorageExceeded(currentStorage + size);
    }
  }
}
