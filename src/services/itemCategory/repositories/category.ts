import { In } from 'typeorm';

import { AppDataSource } from '../../../plugins/datasource';
import { Item } from '../../item/entities/Item';
import { Category } from '../entities/Category';

export const CategoryRepository = AppDataSource.getRepository(Category).extend({
  async getAll(): Promise<Category[]> {
    return this.find();
  },

  /**
   * Get Category matching the given `id` or `null`, if not found.
   * @param id Category's id
   */
  async get(id: string): Promise<Category> {
    return this.findOneBy({ id });
  },
});
