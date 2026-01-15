import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import {
  type ItemGeolocation,
  ItemType,
  type PermissionLevelOptions,
  type UUID,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import type { MaybeUser, MinimalMember } from '../../../../types';
import { ItemNotFolder } from '../../../../utils/errors';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import { type FolderItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

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

  async getFolder(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: ItemRaw['id'],
    permission?: PermissionLevelOptions,
  ): Promise<FolderItem> {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
      permission,
    });
    if (!isItemType(item, ItemType.FOLDER)) {
      throw new WrongItemTypeError(item.type);
    }
    return item as FolderItem;
  }

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'settings' | 'lang'>> & Pick<ItemRaw, 'name'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<FolderItem> {
    return (await super.post(dbConnection, member, {
      ...args,
      item: { ...args.item, type: ItemType.FOLDER, extra: { folder: {} } },
    })) as FolderItem;
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    body: Partial<Pick<ItemRaw, 'name' | 'description' | 'settings' | 'lang'>>,
  ): Promise<FolderItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(dbConnection, member, item.id, body)) as FolderItem;
  }

  async switchToCapsule(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
  ): Promise<FolderItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: itemId });
    }

    return (await super.patch(dbConnection, member, item.id, {
      extra: { folder: { isCapsule: true } },
    })) as FolderItem;
  }
}
