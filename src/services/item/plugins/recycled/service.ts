import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../util/repositories';
import { validatePermission } from '../../../authorization';
import { Member } from '../../../member/entities/member';

export class RecycledBinService {
  async getAll(actor: Member, repositories: Repositories) {
    const { recycledItemRepository } = repositories;
    // TODO: check member is connected

    return recycledItemRepository.getOwnRecycledItemDatas(actor);
  }

  async recycle(actor: Member, repositories: Repositories, itemId: string) {
    const { itemRepository, recycledItemRepository } = repositories;

    // if item is already deleted, it will throw not found here
    const item = await itemRepository.get(itemId);

    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // remove all descendants
    const descendants = await itemRepository.getDescendants(item);
    await itemRepository.softRemove(descendants);

    return recycledItemRepository.recycleOne(item, actor);
  }

  async recycleMany(actor: Member, repositories: Repositories, itemIds: string[]) {
    const { itemRepository, recycledItemRepository } = repositories;

    const { data: items } = await itemRepository.getMany(itemIds, { throwOnError: true });

    // if item is already deleted, it will throw not found here
    for (const item of Object.values(items)) {
      await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    }

    // get descendants of all items
    const descendants = await itemRepository.getManyDescendants(Object.values(items));

    await itemRepository.softRemove([...descendants, ...Object.values(items)]);

    return recycledItemRepository.recycleMany(Object.values(items), actor);
  }

  async restoreOne(actor: Member, repositories: Repositories, itemId: string) {
    const { itemRepository, recycledItemRepository } = repositories;

    const item = await itemRepository.get(itemId, { withDeleted: true });

    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    await itemRepository.recover(item);

    return recycledItemRepository.restoreOne(item);
  }

  async restoreMany(actor: Member, repositories: Repositories, itemIds: string[]) {
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
