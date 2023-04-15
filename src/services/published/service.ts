import { ItemTagType, PermissionLevel, UUID } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { filterOutHiddenItems, validatePermission } from '../authorization';
import ItemService from '../item/service';

export class ItemPublishedService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async get(actor, repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.PUBLIC, { shouldThrow: true });

    return itemPublishedRepository.getForItem(item);
  }

  async post(actor, repositories, itemId: string) {
    const { itemPublishedRepository, itemTagRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // item should be public first
    await itemTagRepository.getType(item, ItemTagType.PUBLIC, { shouldThrow: true });

    return itemPublishedRepository.post(actor, item);
  }

  async delete(actor, repositories, itemId: string) {
    const { itemPublishedRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return itemPublishedRepository.deleteForItem(item);
  }

  async getItemsForMember(actor, repositories, memberId: UUID) {
    const { itemPublishedRepository } = repositories;
    return itemPublishedRepository.getItemsForMember(memberId);
  }

  // filter out by categories, not defined will return all items
  async getItemsByCategories(actor, repositories: Repositories, categoryIds?: string[]) {
    const { itemPublishedRepository } = repositories;

    if (!categoryIds?.length) {
      const items = await itemPublishedRepository.getAllItems();
      return filterOutHiddenItems(repositories, items);
    }

    // get by categories
    const items = await itemPublishedRepository.getByCategories(categoryIds);

    return filterOutHiddenItems(repositories, items);
  }
}
