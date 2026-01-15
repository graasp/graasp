import { singleton } from 'tsyringe';

import { ItemType, UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import type { MinimalMember } from '../../../../types';
import { ItemNotFolder } from '../../../../utils/errors';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import { CapsuleItem } from '../../discrimination';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

@singleton()
export class CapsuleItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizedItemService: AuthorizedItemService,
    itemWrapperService: ItemWrapperService,
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

  async create(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'settings' | 'lang'>> & Pick<ItemRaw, 'name'>;
      parentId?: string;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<CapsuleItem> {
    return (await super.post(dbConnection, member, {
      ...args,
      item: { ...args.item, type: ItemType.FOLDER, extra: { folder: { isCapsule: true } } },
    })) as CapsuleItem;
  }

  async switchToFolder(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
  ): Promise<CapsuleItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: itemId });
    }

    return (await super.patch(dbConnection, member, item.id, {
      extra: { folder: { isCapsule: false } },
    })) as CapsuleItem;
  }
}
