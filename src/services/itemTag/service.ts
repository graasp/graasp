import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import { Member } from '../member/entities/member';

export class ItemTagService {
  async getForItem(actor: Member, repositories: Repositories, itemId: string) {
    const { itemRepository, itemTagRepository } = repositories;
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemTagRepository.getForItem(item);
  }
  async getForManyItems(actor: Member, repositories: Repositories, itemIds: string[]) {
    const { itemRepository, itemTagRepository } = repositories;
    const { data } = await itemRepository.getMany(itemIds, { throwOnError: true });
    const items = Object.values(data);

    await Promise.all(
      items.map(async (item) => {
        await validatePermission(repositories, PermissionLevel.Read, actor, item);
      }),
    );

    return itemTagRepository.getForManyItems(items);
  }

  async has(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemRepository, itemTagRepository } = repositories;
    const item = await itemRepository.get(id);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemTagRepository.getType(item, tagType);
  }

  async post(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemRepository, itemTagRepository } = repositories;
    const item = await itemRepository.get(id);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemTagRepository.post(actor, item, tagType);
  }

  async deleteOne(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemRepository, itemTagRepository } = repositories;
    const item = await itemRepository.get(id);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    await itemTagRepository.deleteOne(item, tagType);
  }
}
