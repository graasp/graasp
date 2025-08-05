import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import { type ItemGeolocation, ItemType } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { PageItem } from '../../discrimination';
import { ItemService } from '../../item.service';

@singleton()
export class PageItemService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
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

    return newItem as PageItem;
  }
}
