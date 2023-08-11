import { AppDataSource } from '../../../../../plugins/datasource';
import { Category } from '../entities/Category';
import { CategoryNotFound } from '../errors';

export const CategoryRepository = AppDataSource.getRepository(Category).extend({
  async getAll(): Promise<Category[]> {
    return this.find();
  },

  /**
   * Get Category matching the given `id` or `null`, if not found.
   * @param id Category's id
   */
  async get(id: string): Promise<Category | null> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new CategoryNotFound(id);
    }
    return this.findOneBy({ id });
  },
});
