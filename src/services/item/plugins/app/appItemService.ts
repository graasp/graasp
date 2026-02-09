import { singleton } from 'tsyringe';

import { type ItemGeolocation, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { WrongItemTypeError } from '../../errors';
import { AppItem, type ItemRaw, isAppItem } from '../../item';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { PackedItemService } from '../../packedItem.dto';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
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
    authorizedItemService: AuthorizedItemService,
    itemWrapperService: PackedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    recycledBinService: RecycledBinService,
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
      authorizedItemService,
      itemWrapperService,
      itemVisibilityRepository,
      recycledBinService,
      log,
    );
  }

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: Partial<Pick<ItemRaw, 'description' | 'lang'>> &
      Pick<ItemRaw, 'name'> & {
        url: string;
        parentId?: string;
        geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
        previousItemId?: ItemRaw['id'];
      },
  ): Promise<AppItem> {
    const { name, description, lang, url, ...options } = args;

    const newItem = {
      type: 'app' as const,
      name,
      description,
      lang,
      extra: { app: { url } },
    };
    return (await super.post(dbConnection, member, {
      item: newItem,
      ...options,
    })) as AppItem;
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    args: Partial<Pick<ItemRaw, 'name' | 'description' | 'lang' | 'settings'>>,
  ): Promise<AppItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is app
    if (!isAppItem(item)) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(dbConnection, member, itemId, args)) as AppItem;
  }
}
