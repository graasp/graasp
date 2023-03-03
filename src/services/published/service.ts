import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';

export class ItemPublishedService {
  async get(actor, repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.PUBLIC, { shouldThrow: true });

    return itemPublishedRepository.getForItem(item);
  }

  async post(actor, repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.PUBLIC, { shouldThrow: true });

    return itemPublishedRepository.post(actor, item);
  }

  async delete(actor, repositories, itemId: string) {
    const { itemPublishedRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemPublishedRepository.deleteForItem(item);
  }

  async getOwnItems(actor, repositories) {
    const { itemPublishedRepository } = repositories;
    return itemPublishedRepository.getOwnItems(actor);
  }

  // filter out by categories, not defined will return all items
  async getItemsByCategories(actor, repositories: Repositories, categoryIds?: string[]) {
    const { itemPublishedRepository } = repositories;

    if (!categoryIds?.length) {
      const items = await itemPublishedRepository.getAllItems();
      return items;
    }

    // get by categories
    const items = await itemPublishedRepository.getByCategories(categoryIds);

    return items;
  }
}
