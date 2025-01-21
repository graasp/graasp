import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import { ItemGeolocation, ItemType, UUID } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { FolderItem, Item } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
export class FolderItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, meilisearchWrapper, log);
  }

  async post(
    member: Member,
    repositories: Repositories,
    args: {
      item: Partial<Pick<Item, 'description' | 'settings' | 'lang'>> & Pick<Item, 'name'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ): Promise<FolderItem> {
    return (await super.post(member, repositories, {
      ...args,
      item: { ...args.item, type: ItemType.FOLDER, extra: { folder: {} } },
    })) as FolderItem;
  }

  async patch(
    member: Member,
    repositories: Repositories,
    itemId: UUID,
    body: Partial<Pick<Item, 'name' | 'description' | 'settings' | 'lang'>>,
  ): Promise<FolderItem> {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(member, repositories, item.id, body)) as FolderItem;
  }
}
