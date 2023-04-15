import { AppDataSource } from '../../../plugins/datasource';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../utils/typeormError';
import { Item } from '../../item/entities/Item';
import { ItemCategory } from '../entities/ItemCategory';
import { DuplicateItemCategoryError } from '../errors';

/**
 * Database's first layer of abstraction for Categorys
 */
export const ItemCategoryRepository = AppDataSource.getRepository(ItemCategory).extend({
  async get(id: string): Promise<ItemCategory[]> {
    return this.findOne({ where: { id }, relations: { category: true } });
  },

  /**
   * Get itemCategory matching the given `itemid` or `null`, if not found.
   * @param id item's id
   */
  async getForItem(itemId: string): Promise<ItemCategory[]> {
    return this.find({ where: { item: { id: itemId } }, relations: { category: true } });
  },

  async post(itemPath: string, categoryId: string): Promise<ItemCategory> {
    try {
      const created = await this.insert({ item: { path: itemPath }, category: { id: categoryId } });
      return this.get(created.identifiers[0].id);
    } catch (e) {
      // TODO: e instanceof QueryFailedError
      if (e.code === DUPLICATE_ENTRY_ERROR_CODE) {
        throw new DuplicateItemCategoryError({ itemPath, categoryId });
      }
      throw e;
    }
    // TODO: better solution?
    // query builder returns creator as id and extra as string
  },

  async deleteOne(id: string): Promise<string> {
    await this.delete(id);
    return id;
  },
});
