import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../util/repositories';
import { validatePermission } from '../../authorization';

export class ItemCategoryService {
  async getForItem(actor, repositories: Repositories, itemId: string) {
    const { itemRepository, itemCategoryRepository } = repositories;
    const item = await itemRepository.get(itemId);
    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemCategoryRepository.getForItem(itemId);
  }

  async post(actor, repositories: Repositories, itemId: string, categoryId: string) {
    const { itemRepository, itemCategoryRepository } = repositories;
    const item = await itemRepository.get(itemId);
    // check rights
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    return itemCategoryRepository.post(item.path, categoryId);
  }

  async delete(actor, repositories: Repositories, itemId: string, categoryId: string) {
    const { itemRepository, itemCategoryRepository } = repositories;
    const item = await itemRepository.get(itemId);
    // check rights
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

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
