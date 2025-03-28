import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import {
  ItemGeolocation,
  ItemType,
  PermissionLevel,
  PermissionLevelOptions,
  UUID,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser, MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { FolderItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../service';
import { ItemGeolocationRepository } from '../geolocation/geolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
export class FolderItemService extends ItemService {
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

  async getFolder(
    db: DBConnection,
    member: MaybeUser,
    itemId: Item['id'],
    permission?: PermissionLevelOptions,
  ): Promise<FolderItem> {
    const item = await this.basicItemService.get(db, member, itemId, permission);
    if (!isItemType(item, ItemType.FOLDER)) {
      throw new WrongItemTypeError(item.type);
    }
    return item as FolderItem;
  }

  async postWithOptions(
    db: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<Item, 'description' | 'settings' | 'lang'>> & Pick<Item, 'name'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ): Promise<FolderItem> {
    return (await super.post(db, member, {
      ...args,
      item: { ...args.item, type: ItemType.FOLDER, extra: { folder: {} } },
    })) as FolderItem;
  }

  async patch(
    db: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    body: Partial<Pick<Item, 'name' | 'description' | 'settings' | 'lang'>>,
  ): Promise<FolderItem> {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(db, member, item.id, body)) as FolderItem;
  }
}
