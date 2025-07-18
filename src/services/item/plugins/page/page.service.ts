import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import { type ItemGeolocation, ItemType, PermissionLevel, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { PageItem } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { PageRepository } from './page.repository';

@singleton()
export class PageItemService {
  private readonly itemService: ItemService;
  private readonly itemRepository: ItemRepository;
  private readonly pageRepository: PageRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    itemService: ItemService,
    pageRepository: PageRepository,
    itemRepository: ItemRepository,
    authorizedItemService: AuthorizedItemService,
  ) {
    this.itemService = itemService;
    this.itemRepository = itemRepository;
    this.pageRepository = pageRepository;
    this.authorizedItemService = authorizedItemService;
  }

  async create(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'settings' | 'lang'>> & Pick<ItemRaw, 'name'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<PageItem> {
    // create item
    const newItem = await this.itemService.post(dbConnection, member, {
      ...args,
      item: { ...args.item, type: ItemType.PAGE, extra: {} },
    });

    // create page properties row
    await this.pageRepository.createContent(dbConnection, newItem.id);

    return newItem;
  }

  async updateContent(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    content: string,
  ): Promise<void> {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      permission: PermissionLevel.Write,
      accountId: member.id,
      itemId,
    });

    // check item is page
    if (item.type !== ItemType.PAGE) {
      throw new WrongItemTypeError(item.type);
    }

    await this.pageRepository.updateContent(dbConnection, content);
  }
}
