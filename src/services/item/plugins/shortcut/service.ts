import { singleton } from 'tsyringe';

import { ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import i18next from '../../../../i18n';
import { BaseLogger } from '../../../../logger';
import { MinimalMember } from '../../../../types';
import { ThumbnailService } from '../../../thumbnail/service';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
export class ShortcutItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    meilisearchWrapper: MeiliSearchWrapper,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, meilisearchWrapper, log);
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

    const targetItem = await super.get(db, member, target);

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
    if (item.type !== ItemType.SHORTCUT) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description } = body;

    return (await super.patch(db, member, item.id, {
      name,
      description,
    })) as ShortcutItem;
  }
}
