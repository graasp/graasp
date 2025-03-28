import { singleton } from 'tsyringe';

import { ItemGeolocation, ItemType, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { AppItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

@singleton()
export class AppItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizationService: AuthorizationService,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    basicItemService: BasicItemService,
    log: BaseLogger,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizationService,
      itemWrapperService,
      itemVisibilityRepository,
      basicItemService,
      log,
    );
  }

  async postWithOptions(
    db: DBConnection,
    member: MinimalMember,
    args: Partial<Pick<Item, 'description' | 'lang'>> &
      Pick<Item, 'name'> & {
        url: string;
        parentId?: string;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        previousItemId?: Item['id'];
      },
  ): Promise<AppItem> {
    const { name, description, lang, url, ...options } = args;

    const newItem = {
      type: ItemType.APP,
      name,
      description,
      lang,
      extra: { app: { url } },
    };
    return (await super.post(db, member, {
      item: newItem,
      ...options,
    })) as AppItem;
  }

  async patch(
    db: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    args: Partial<Pick<Item, 'name' | 'description' | 'lang' | 'settings'>>,
  ): Promise<AppItem> {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // check item is app
    if (!isItemType(item, ItemType.APP)) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(db, member, itemId, args)) as AppItem;
  }
}
