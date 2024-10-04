import { singleton } from 'tsyringe';

import { Paginated, Pagination, PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { ItemThumbnailService } from '../thumbnail/service';
import { RecycledItemData } from './RecycledItemData';

@singleton()
export class RecycledBinService {
  private readonly itemThumbnailService: ItemThumbnailService;
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

  constructor(itemThumbnailService: ItemThumbnailService) {
    this.itemThumbnailService = itemThumbnailService;
  }

  async getOwn(
    member: Member,
    repositories: Repositories,
    pagination: Pagination,
  ): Promise<Paginated<RecycledItemData>> {
    const { recycledItemRepository } = repositories;

    const recycled = await recycledItemRepository.getOwn(member, pagination);

    return recycled;
  }

  async recycleMany(actor: Member, repositories: Repositories, itemIds: string[]) {
    const { itemRepository, recycledItemRepository } = repositories;

    const itemsResult = await itemRepository.getMany(itemIds, { throwOnError: true });
    const { data: idsToItems } = itemsResult;
    const items = Object.values(idsToItems);

    // if item is already deleted, it will throw not found here
    for (const item of items) {
      await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    }

    const descendants = await itemRepository.getManyDescendants(items);

    for (const item of items) {
      await this.hooks.runPreHooks('recycle', actor, repositories, { item, isRecycledRoot: true });
    }
    for (const d of descendants) {
      await this.hooks.runPreHooks('recycle', actor, repositories, {
        item: d,
        isRecycledRoot: false,
      });
    }

    await itemRepository.softRemove([...descendants, ...items]);
    await recycledItemRepository.addMany(items, actor);

    for (const d of descendants) {
      this.hooks.runPostHooks('recycle', actor, repositories, { item: d, isRecycledRoot: false });
    }
    for (const item of items) {
      await this.hooks.runPostHooks('recycle', actor, repositories, { item, isRecycledRoot: true });
    }

    return itemsResult;
  }

  async restoreMany(member: Member, repositories: Repositories, itemIds: string[]) {
    const { itemRepository, recycledItemRepository } = repositories;

    const result = await itemRepository.getMany(itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const { data: idsToItems } = result;

    const items = Object.values(idsToItems);

    for (const item of items) {
      await validatePermission(repositories, PermissionLevel.Admin, member, item);
    }

    // since the subtree is currently soft-deleted before recovery, need withDeleted=true
    const descendants = await itemRepository.getManyDescendants(items, { withDeleted: true });

    for (const item of items) {
      await this.hooks.runPreHooks('restore', member, repositories, { item, isRestoredRoot: true });
    }
    for (const d of descendants) {
      await this.hooks.runPreHooks('restore', member, repositories, {
        item: d,
        isRestoredRoot: false,
      });
    }

    await itemRepository.recover([...descendants, ...items]);
    await recycledItemRepository.deleteManyByItemPath(items.map((item) => item.path));

    for (const item of items) {
      await this.hooks.runPostHooks('restore', member, repositories, {
        item,
        isRestoredRoot: true,
      });
    }
    for (const d of descendants) {
      await this.hooks.runPostHooks('restore', member, repositories, {
        item: d,
        isRestoredRoot: false,
      });
    }

    return result;
  }
}
