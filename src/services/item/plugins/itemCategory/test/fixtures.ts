import { CategoryType } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member.js';
import { Item } from '../../../entities/Item.js';
import { Category } from '../entities/Category.js';
import { ItemCategory } from '../entities/ItemCategory.js';
import { CategoryRepository } from '../repositories/category.js';
import { ItemCategoryRepository } from '../repositories/itemCategory.js';

export const saveCategories = async () => {
  const categories: Category[] = [];
  categories.push(await CategoryRepository.save({ name: 'level-1', type: CategoryType.Level }));
  categories.push(await CategoryRepository.save({ name: 'level-2', type: CategoryType.Level }));
  categories.push(await CategoryRepository.save({ name: 'level-3', type: CategoryType.Level }));
  categories.push(
    await CategoryRepository.save({ name: 'discipline-1', type: CategoryType.Discipline }),
  );
  categories.push(
    await CategoryRepository.save({ name: 'discipline-2', type: CategoryType.Discipline }),
  );
  return categories;
};

export const saveItemCategories = async ({
  item,
  categories,
  creator,
}: {
  item: Item;
  categories: Category[];
  creator?: Member;
}) => {
  const itemCategories: ItemCategory[] = [];
  for (const category of categories) {
    itemCategories.push(await ItemCategoryRepository.save({ item, category, creator }));
  }
  return itemCategories;
};
