import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import i18next from '../../../../i18n';
import { BaseLogger } from '../../../../logger';
import { type MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { WrongItemTypeError } from '../../errors';
import { type ItemRaw, ShortcutItem, isShortcutItem } from '../../item';
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
export class ShortcutItemService extends ItemService {
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
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'name'>>;
      target: ItemRaw['id'];
      parentId?: string;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<ShortcutItem> {
    const { target, item, ...properties } = args;
    const { description, name: definedName } = item;

    const targetItem = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId: target,
    });

    // generate name from target item if not defined
    const name =
      definedName ??
      i18next.t('DEFAULT_SHORTCUT_NAME', { name: targetItem.name, lng: member.lang });

    return (await super.post(dbConnection, member, {
      ...properties,
      item: {
        name,
        description,
        type: 'shortcut',
        extra: { shortcut: { target } },
      },
    })) as ShortcutItem;
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    body: Partial<Pick<ItemRaw, 'name' | 'description'>>,
  ): Promise<ShortcutItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is shortcut
    if (!isShortcutItem(item)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description } = body;

    return (await super.patch(dbConnection, member, item.id, {
      name,
      description,
    })) as ShortcutItem;
  }
}
