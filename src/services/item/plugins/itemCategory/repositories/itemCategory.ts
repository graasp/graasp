import { QueryFailedError } from 'typeorm';

import { AppDataSource } from '../../../../../plugins/datasource';
import { MemberNotFound } from '../../../../../utils/errors';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../../../utils/typeormError';
import { itemCategorySchema } from '../../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../../member/plugins/export-data/utils/selection.utils';
import { Item } from '../../../entities/Item';
import { ItemCategory } from '../entities/ItemCategory';
import { DuplicateItemCategoryError } from '../errors';

/**
 * Database's first layer of abstraction for Categorys
 */

export const ItemCategoryRepository = AppDataSource.getRepository(ItemCategory).extend({
  async get(id: string): Promise<ItemCategory> {
    return this.findOneOrFail({ where: { id }, relations: { category: true, item: true } });
  },

  /**
   * Get itemCategory matching the given `itemid` or `null`, if not found.
   * @param id item's id
   */
  async getForItem(itemId: string): Promise<ItemCategory[]> {
    return this.find({
      where: { item: { id: itemId } },
      relations: { category: true, item: true },
    });
  },

  /**
   * Get itemCategory list that matches the parents of `itemid` or `null`, if not found.
   * @param id item's id
   */
  async getForItemOrParent(item: Item): Promise<ItemCategory[]> {
    return await this.createQueryBuilder('ic')
      .innerJoinAndSelect('ic.category', 'category', 'ic.item_path @> :itemPath', {
        itemPath: item.path,
      })
      .getMany();
  },

  /**
   * Get itemCategory for a given member.
   * @param memberId the id of the member.
   * @returns an array of the item categories.
   */
  async getForMemberExport(memberId: string): Promise<ItemCategory[]> {
    if (!memberId) {
      throw new MemberNotFound();
    }

    return this.find({
      select: schemaToSelectMapper(itemCategorySchema),
      where: { creator: { id: memberId } },
      relations: { category: true, item: true },
    });
  },

  async post(itemPath: string, categoryId: string): Promise<ItemCategory> {
    try {
      const created = await this.insert({ item: { path: itemPath }, category: { id: categoryId } });
      return this.get(created.identifiers[0].id);
    } catch (e) {
      // TODO: e instanceof QueryFailedError
      if (e instanceof QueryFailedError && e.driverError.code === DUPLICATE_ENTRY_ERROR_CODE) {
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
