import { CategoryType } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { Category } from '../entities/Category';
import { ItemCategory } from '../entities/ItemCategory';
import { ItemCategoryRepository } from '../repositories/itemCategory';

export const saveCategories = async () => {
  const categories: Category[] = [];
  const rawRepository = AppDataSource.getRepository(Category);
  categories.push(await rawRepository.save({ name: 'level-1', type: CategoryType.Level }));
  categories.push(await rawRepository.save({ name: 'level-2', type: CategoryType.Level }));
  categories.push(await rawRepository.save({ name: 'level-3', type: CategoryType.Level }));
  categories.push(
    await rawRepository.save({ name: 'discipline-1', type: CategoryType.Discipline }),
  );
  categories.push(
    await rawRepository.save({ name: 'discipline-2', type: CategoryType.Discipline }),
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
