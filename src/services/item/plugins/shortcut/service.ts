import { singleton } from 'tsyringe';

import { ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import i18next from '../../../../i18n';
import { BaseLogger } from '../../../../logger';
import { MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { ShortcutItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

@singleton()
export class ShortcutItemService extends ItemService {
  constructor(
    basicItemService: BasicItemService,
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
    args: {
      item: Partial<Pick<Item, 'description' | 'name'>>;
      target: Item['id'];
      parentId?: string;
      previousItemId?: Item['id'];
    },
  ): Promise<ShortcutItem> {
    const { target, item, ...properties } = args;
    const { description, name: definedName } = item;

    const targetItem = await this.basicItemService.get(db, member, target);

    // generate name from target item if not defined
    const name =
      definedName ??
      i18next.t('DEFAULT_SHORTCUT_NAME', { name: targetItem.name, lng: member.lang });

    return (await super.post(db, member, {
      ...properties,
      item: {
        name,
        description,
        type: ItemType.SHORTCUT,
        extra: { shortcut: { target } },
      },
    })) as ShortcutItem;
  }

  async patch(
    db: DBConnection,
    member: MinimalMember,
    itemId: Item['id'],
    body: Partial<Pick<Item, 'name' | 'description'>>,
  ): Promise<ShortcutItem> {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // check item is shortcut
    if (!isItemType(item, ItemType.SHORTCUT)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description } = body;

    return (await super.patch(db, member, item.id, {
      name,
      description,
    })) as ShortcutItem;
  }
}
