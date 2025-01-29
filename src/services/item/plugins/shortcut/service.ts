import { singleton } from 'tsyringe';

import { ItemType } from '@graasp/sdk';

import i18next from '../../../../i18n';
import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { Item, ShortcutItem } from '../../entities/Item';
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
    member: Member,
    repositories: Repositories,
    args: {
      item: Partial<Pick<Item, 'description' | 'name'>>;
      target: Item['id'];
      parentId?: string;
      previousItemId?: Item['id'];
    },
  ): Promise<ShortcutItem> {
    const { target, item, ...properties } = args;
    const { description, name: definedName } = item;

    const targetItem = await super.get(member, repositories, target);

    // generate name from target item if not defined
    const name =
      definedName ??
      i18next.t('DEFAULT_SHORTCUT_NAME', { name: targetItem.name, lng: member.lang });

    return (await super.post(member, repositories, {
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
    member: Member,
    repositories: Repositories,
    itemId: Item['id'],
    body: Partial<Pick<Item, 'name' | 'description'>>,
  ): Promise<ShortcutItem> {
    const { itemRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is shortcut
    if (item.type !== ItemType.SHORTCUT) {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(member, repositories, item.id, body)) as ShortcutItem;
  }
}
