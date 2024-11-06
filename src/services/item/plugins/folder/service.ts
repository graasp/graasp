import { singleton } from 'tsyringe';

import { ItemType, UUID } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { Item } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
export class FolderItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, log);
  }

  async patchFolder(
    member: Member,
    repositories: Repositories,
    itemId: UUID,
    body: Partial<Pick<Item, 'name' | 'description' | 'settings' | 'lang'>>,
  ) {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new WrongItemTypeError(item.type);
    }

    return await super._patch(member, repositories, item, { ...body, type: ItemType.FOLDER });
  }
}
