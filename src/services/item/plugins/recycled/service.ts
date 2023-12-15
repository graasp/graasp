import { PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';

export class RecycledBinService {
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

  async getAll(actor: Actor, repositories: Repositories) {
    const { recycledItemRepository } = repositories;
    // check member is connected
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    return recycledItemRepository.getOwnRecycledItemDatas(actor);
  }

  async recycleMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
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
    await recycledItemRepository.recycleMany(items, actor);

    for (const d of descendants) {
      this.hooks.runPostHooks('recycle', actor, repositories, { item: d, isRecycledRoot: false });
    }
    for (const item of items) {
      await this.hooks.runPostHooks('recycle', actor, repositories, { item, isRecycledRoot: true });
    }

    return itemsResult;
  }

  async restoreMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, recycledItemRepository } = repositories;

    const result = await itemRepository.getMany(itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const { data: idsToItems } = result;

    const items = Object.values(idsToItems);

    for (const item of items) {
      await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    }

    // since the subtree is currently soft-deleted before recovery, need withDeleted=true
    const descendants = await itemRepository.getManyDescendants(items, { withDeleted: true });

    for (const item of items) {
      await this.hooks.runPreHooks('restore', actor, repositories, { item, isRestoredRoot: true });
    }
    for (const d of descendants) {
      await this.hooks.runPreHooks('restore', actor, repositories, {
        item: d,
        isRestoredRoot: false,
      });
    }

    await itemRepository.recover([...descendants, ...items]);
    await recycledItemRepository.restoreMany(items);

    for (const item of items) {
      await this.hooks.runPostHooks('restore', actor, repositories, { item, isRestoredRoot: true });
    }
    for (const d of descendants) {
      await this.hooks.runPostHooks('restore', actor, repositories, {
        item: d,
        isRestoredRoot: false,
      });
    }

    return result;
  }
}
