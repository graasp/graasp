import { FileItemType, MemberStorage } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories.js';
import { DEFAULT_MAX_STORAGE } from '../../../item/plugins/file/utils/constants.js';
import { StorageExceeded } from '../../../item/plugins/file/utils/errors.js';
import { Member } from '../../entities/member.js';

export class StorageService {
  fileItemType: FileItemType;

  constructor(fileItemType: FileItemType) {
    this.fileItemType = fileItemType;
  }

  async getMaximumStorageSize(_actor: Member): Promise<number> {
    // todo: depends on user/group
    return DEFAULT_MAX_STORAGE;
  }

  async getStorageLimits(
    actor: Member,
    type: FileItemType,
    { itemRepository }: Repositories,
  ): Promise<MemberStorage> {
    return {
      current: await itemRepository.getItemSumSize(actor?.id, type),
      maximum: await this.getMaximumStorageSize(actor),
    };
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  // todo: include more item types
  async checkRemainingStorage(actor: Member, repositories: Repositories, size = 0) {
    const { id: memberId } = actor;

    const currentStorage = await repositories.itemRepository.getItemSumSize(
      memberId,
      this.fileItemType,
    );

    const maxStorage = await this.getMaximumStorageSize(actor);
    if (currentStorage + size > maxStorage) {
      throw new StorageExceeded(currentStorage + size);
    }
  }
}
