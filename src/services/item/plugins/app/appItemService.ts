import { singleton } from 'tsyringe';

import { ItemGeolocation, ItemType, UUID } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { AppItem, Item, isItemType } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
export class AppItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, meilisearchWrapper, log);
  }

  async postWithOptions(
    member: Member,
    repositories: Repositories,
    args: Partial<Pick<Item, 'description' | 'lang'>> &
      Pick<Item, 'name'> & {
        url: string;
        parentId?: string;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        previousItemId?: Item['id'];
      },
  ): Promise<AppItem> {
    const { name, description, lang, url, ...options } = args;

    const newItem = { type: ItemType.APP, name, description, lang, extra: { app: { url } } };
    return (await super.post(member, repositories, {
      item: newItem,
      ...options,
    })) as AppItem;
  }

  async patch(
    member: Member,
    repositories: Repositories,
    itemId: UUID,
    args: Partial<Pick<Item, 'name' | 'description' | 'lang' | 'settings'>>,
  ): Promise<AppItem> {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is app
    if (!isItemType(item, ItemType.APP)) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(member, repositories, itemId, args)) as AppItem;
  }
}
