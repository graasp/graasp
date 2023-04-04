import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../util/repositories';
import ItemService from '../../item/service';

export class ItemCategoryService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor, repositories: Repositories, itemId: string) {
    const { itemCategoryRepository } = repositories;
    // get and check permissions
    await this.itemService.get(actor, repositories, itemId);

    return itemCategoryRepository.getForItem(itemId);
  }

  async post(actor, repositories: Repositories, itemId: string, categoryId: string) {
    const { itemCategoryRepository } = repositories;

    // get and check permissions
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    return itemCategoryRepository.post(item.path, categoryId);
  }

  async delete(actor, repositories: Repositories, itemId: string, categoryId: string) {
    const { itemCategoryRepository } = repositories;

    // get and check permissions
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    return itemCategoryRepository.deleteOne(categoryId);
  }

  // async getItemsByCategories(actor, repositories: Repositories, categoryIds: string[]) {
  //   const { itemCategoryRepository, itemTagRepository } = repositories;
  //   const itemsByCategories = await itemCategoryRepository.getItemsByCategories(categoryIds);
  //   // items should be PUBLIC
  //   const publicItemsValues = await itemTagRepository.hasManyForMany(itemsByCategories, [
  //     ItemTagType.PUBLIC,
  //   ]);
  //   const publicItems = itemsByCategories
  //     .filter((item) => {
  //       return publicItemsValues.data[item.path] ? item : null;
  //     })
  //     .filter(Boolean);

  //   return publicItems;
  // }
}
