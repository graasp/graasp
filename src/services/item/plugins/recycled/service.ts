import { PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';

export class RecycledBinService {
  private readonly hooks = new HookManager<{
    recycle: { pre: { item: Item }; post: { item: Item } };
    restore: { pre: { item: Item }; post: { item: Item } };
  }>();

  async getAll(actor: Actor, repositories: Repositories) {
    const { recycledItemRepository } = repositories;
    // check member is connected
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    return recycledItemRepository.getOwnRecycledItemDatas(actor);
  }

  async recycle(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, recycledItemRepository } = repositories;

    // if item is already deleted, it will throw not found here
    const item = await itemRepository.get(itemId);

    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // remove all descendants
    const descendants = await itemRepository.getDescendants(item);
    for (const d of descendants) {
      await this.hooks.runPreHooks('recycle', actor, repositories, { item: d });
    }
    await itemRepository.softRemove(descendants);
    for (const d of descendants) {
      this.hooks.runPostHooks('recycle', actor, repositories, { item: d });
    }

    await this.hooks.runPreHooks('recycle', actor, repositories, { item });
    const result = recycledItemRepository.recycleOne(item, actor);
    await this.hooks.runPostHooks('recycle', actor, repositories, { item });

    return result;
  }

  async recycleMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, recycledItemRepository } = repositories;

    const { data: idsToItems } = await itemRepository.getMany(itemIds, { throwOnError: true });
    const items = Object.values(idsToItems);

    // if item is already deleted, it will throw not found here
    for (const item of items) {
      await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    }

    // get descendants of all items
    const descendants = await itemRepository.getManyDescendants(items);

    for (const d of descendants) {
      await this.hooks.runPreHooks('recycle', actor, repositories, { item: d });
    }
    await itemRepository.softRemove([...descendants, ...items]);
    for (const d of descendants) {
      this.hooks.runPostHooks('recycle', actor, repositories, { item: d });
    }

    for (const item of items) {
      await this.hooks.runPreHooks('recycle', actor, repositories, { item });
    }
    const result = await recycledItemRepository.recycleMany(items, actor);
    for (const item of items) {
      await this.hooks.runPostHooks('recycle', actor, repositories, { item });
    }

    return result;
  }

  async restoreOne(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, recycledItemRepository } = repositories;

    const item = await itemRepository.get(itemId, { withDeleted: true });

    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    await itemRepository.recover(item);

    return recycledItemRepository.restoreOne(item);
  }

  async restoreMany(actor: Actor, repositories: Repositories, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, recycledItemRepository } = repositories;

    const { data: items } = await itemRepository.getMany(itemIds, {
      throwOnError: true,
      withDeleted: true,
    });

    for (const item of Object.values(items)) {
      await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    }

    // TODO: check if item is already deleted?
    await itemRepository.recover(Object.values(items));

    return recycledItemRepository.restoreMany(Object.values(items));
  }
}
