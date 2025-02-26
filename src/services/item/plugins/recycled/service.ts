import { singleton } from 'tsyringe';

import { Paginated, Pagination, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/schema';
import HookManager from '../../../../utils/hook';
import { AuthorizationService } from '../../../authorization';
import { Member } from '../../../member/entities/member';
import { ItemRepository } from '../../repository';
import { RecycledItemDataRepository } from './repository';

@singleton()
export class RecycledBinService {
  private readonly recycledItemRepository: RecycledItemDataRepository;
  private readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;

  constructor(
    recycledItemRepository: RecycledItemDataRepository,
    itemRepository: ItemRepository,
    authorizationService: AuthorizationService,
  ) {
    this.recycledItemRepository = recycledItemRepository;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
  }

  readonly hooks = new HookManager<{
    recycle: {
      pre: { item: Item; isRecycledRoot: boolean };
      post: { item: Item; isRecycledRoot: boolean };
    };
    restore: {
      pre: { item: Item; isRestoredRoot: boolean };
      post: { item: Item; isRestoredRoot: boolean };
    };
  }>();

  async getOwn(db: DBConnection, member: Member, pagination: Pagination): Promise<Paginated<Item>> {
    return await this.recycledItemRepository.getOwnRecycledItems(db, member, pagination);
  }

  async recycleMany(db: DBConnection, actor: Member, itemIds: string[]) {
    const itemsResult = await this.itemRepository.getMany(db, itemIds, { throwOnError: true });
    const { data: idsToItems } = itemsResult;
    const items = Object.values(idsToItems);

    // if item is already deleted, it will throw not found here
    for (const item of items) {
      await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);
    }

    for (const item of items) {
      await this.hooks.runPreHooks('recycle', actor, db, { item, isRecycledRoot: true });
    }
    const descendants = await this.itemRepository.getDescendants(db, item);
    for (const d of descendants) {
      await this.hooks.runPreHooks('recycle', actor, db, {
        item: d,
        isRecycledRoot: false,
      });
    }

    await this.itemRepository.softRemove([...descendants, ...items]);
    await this.recycledItemRepository.addMany(db, items, actor);

    for (const d of descendants) {
      this.hooks.runPostHooks('recycle', actor, db, { item: d, isRecycledRoot: false });
    }
    for (const item of items) {
      await this.hooks.runPostHooks('recycle', actor, db, { item, isRecycledRoot: true });
    }

    return itemsResult;
  }

  async restoreMany(db: DBConnection, member: Member, itemIds: string[]) {
    const result = await this.itemRepository.getMany(db, itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const { data: idsToItems } = result;

    const items = Object.values(idsToItems);

    for (const item of items) {
      await this.authorizationService.validatePermission(db, PermissionLevel.Admin, member, item);
    }

    // since the subtree is currently soft-deleted before recovery, need withDeleted=true

    for (const item of items) {
      await this.hooks.runPreHooks('restore', member, db, { item, isRestoredRoot: true });
    }
    const descendants = await this.recycledItemRepository.getDeletedDescendants(db, item);
    for (const d of descendants) {
      await this.hooks.runPreHooks('restore', member, db, {
        item: d,
        isRestoredRoot: false,
      });
    }

    await this.itemRepository.recover([...descendants, ...items]);
    await this.recycledItemRepository.deleteManyByItemPath(
      db,
      items.map((item) => item.path),
    );

    for (const item of items) {
      await this.hooks.runPostHooks('restore', member, db, {
        item,
        isRestoredRoot: true,
      });
    }
    for (const d of descendants) {
      await this.hooks.runPostHooks('restore', member, db, {
        item: d,
        isRestoredRoot: false,
      });
    }

    return result;
  }
}
