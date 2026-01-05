import { singleton } from 'tsyringe';

import { ItemType, type Paginated, type Pagination, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { ItemNotFound } from '../../../../utils/errors';
import HookManager from '../../../../utils/hook';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { isItemType } from '../../discrimination';
import { ItemRepository } from '../../item.repository';
import { RecycledItemDataRepository } from './recycled.repository';

@singleton()
export class RecycledBinService {
  private readonly recycledItemRepository: RecycledItemDataRepository;
  private readonly itemRepository: ItemRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    recycledItemRepository: RecycledItemDataRepository,
    itemRepository: ItemRepository,
    authorizedItemService: AuthorizedItemService,
  ) {
    this.recycledItemRepository = recycledItemRepository;
    this.itemRepository = itemRepository;
    this.authorizedItemService = authorizedItemService;
  }

  readonly hooks = new HookManager<{
    recycle: {
      pre: { item: ItemRaw; isRecycledRoot: boolean };
      post: { item: ItemRaw; isRecycledRoot: boolean };
    };
    restore: {
      pre: { item: ItemRaw; isRestoredRoot: boolean };
      post: { item: ItemRaw; isRestoredRoot: boolean };
    };
  }>();

  async getOwn(
    dbConnection: DBConnection,
    member: MinimalMember,
    pagination: Pagination,
  ): Promise<Paginated<ItemRaw>> {
    return await this.recycledItemRepository.getOwnRecycledItems(dbConnection, member, pagination);
  }

  async getDeletedTreesById(
    dbConnection: DBConnection,
    member: MinimalMember,
    ids: ItemRaw['id'][],
  ) {
    // validate permission on parents
    await this.recycledItemRepository.assertAdminAccessForItemIds(dbConnection, member.id, ids);

    const items = await this.recycledItemRepository.getDeletedTreesById(dbConnection, ids);

    return items;
  }

  async recycleMany(dbConnection: DBConnection, member: MinimalMember, itemIds: string[]) {
    const items = await this.itemRepository.getMany(dbConnection, itemIds);

    // if item is already deleted, it will throw not found here
    for (const item of items) {
      await this.authorizedItemService.assertAccess(dbConnection, {
        permission: PermissionLevel.Admin,
        accountId: member.id,
        item,
      });
    }

    let allDescendants: ItemRaw[] = [];
    for (const item of items) {
      await this.hooks.runPreHooks('recycle', member, dbConnection, { item, isRecycledRoot: true });
      if (isItemType(item, ItemType.FOLDER)) {
        allDescendants = allDescendants.concat(
          await this.itemRepository.getDescendants(dbConnection, item),
        );
      }
    }
    for (const d of allDescendants) {
      await this.hooks.runPreHooks('recycle', member, dbConnection, {
        item: d,
        isRecycledRoot: false,
      });
    }

    const softDeletedItems = await this.itemRepository.softRemove(dbConnection, [
      ...allDescendants,
      ...items,
    ]);
    await this.recycledItemRepository.addMany(dbConnection, items, member);

    for (const d of allDescendants) {
      this.hooks.runPostHooks('recycle', member, dbConnection, { item: d, isRecycledRoot: false });
    }
    for (const item of items) {
      await this.hooks.runPostHooks('recycle', member, dbConnection, {
        item,
        isRecycledRoot: true,
      });
    }

    return softDeletedItems;
  }

  async restoreMany(dbConnection: DBConnection, member: MinimalMember, itemIds: string[]) {
    const items = await this.recycledItemRepository.getManyDeletedItemsById(dbConnection, itemIds);

    // throw if one provided id does not have a corresponding item
    if (items.length !== itemIds.length) {
      throw new ItemNotFound();
    }

    for (const item of items) {
      await this.authorizedItemService.assertAccess(dbConnection, {
        permission: PermissionLevel.Admin,

        accountId: member.id,
        item,
      });
    }

    let allDescendants: ItemRaw[] = [];
    for (const item of items) {
      await this.hooks.runPreHooks('restore', member, dbConnection, { item, isRestoredRoot: true });
      if (isItemType(item, ItemType.FOLDER)) {
        const descendants = await this.recycledItemRepository.getDeletedDescendants(
          dbConnection,
          item,
        );
        for (const d of descendants) {
          await this.hooks.runPreHooks('restore', member, dbConnection, {
            item: d,
            isRestoredRoot: false,
          });
        }
        allDescendants = allDescendants.concat(descendants);
      }
    }

    const recoveredItems = await this.itemRepository.recover(dbConnection, [
      ...allDescendants,
      ...items,
    ]);
    await this.recycledItemRepository.deleteManyByItemPath(
      dbConnection,
      items.map((item) => item.path),
    );

    for (const item of items) {
      await this.hooks.runPostHooks('restore', member, dbConnection, {
        item,
        isRestoredRoot: true,
      });
    }
    for (const d of allDescendants) {
      await this.hooks.runPostHooks('restore', member, dbConnection, {
        item: d,
        isRestoredRoot: false,
      });
    }

    return recoveredItems;
  }
}
