import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import { ItemGeolocation, ItemType, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser, MinimalMember } from '../../../../types';
import { ThumbnailService } from '../../../thumbnail/service';
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

  async get(
    db: DBConnection,
    member: MaybeUser,
    itemId: Item['id'],
    permission?: PermissionLevel,
  ): Promise<FolderItem> {
    const item = await super.get(db, member, itemId, permission);
    if (!isItemType(item, ItemType.FOLDER)) {
      throw new WrongItemTypeError(item.type);
    }
    return item;
  }

  async post(
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
