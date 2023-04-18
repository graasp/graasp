import { AppDataSource } from '../../../../../plugins/datasource';
import { Category } from '../entities/Category';

export const CategoryRepository = AppDataSource.getRepository(Category).extend({
  async getAll(): Promise<Category[]> {
    return this.find();
  },

  /**
   * Get Category matching the given `id` or `null`, if not found.
   * @param id Category's id
   */
  async get(id: string): Promise<Category | null> {
    return this.findOneBy({ id });
  },
});
