import { EntityManager } from 'typeorm';

import { MutableRepository } from '../../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../../repositories/const';
import { InsertionException } from '../../../../../repositories/errors';
import { itemCategorySchema } from '../../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../../member/plugins/export-data/utils/selection.utils';
import { Item } from '../../../entities/Item';
import { ItemCategory } from '../entities/ItemCategory';
import { DuplicateItemCategoryError } from '../errors';

type CreateItemCategoryBody = { itemPath: string; categoryId: string };
const RELATIONS = { category: true, item: true };

/**
 * Database's first layer of abstraction for Categorys
 */
export class ItemCategoryRepository extends MutableRepository<ItemCategory, never> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ItemCategory, manager);
  }

  async getOne(id: string) {
    return await super.findOne(id, { relations: RELATIONS });
  }

  /**
   * Get itemCategory matching the given `itemId` or `null`, if not found.
   * @param id item's id
   */
  async getForItem(itemId: string): Promise<ItemCategory[]> {
    super.throwsIfParamIsInvalid('itemId', itemId);

    return await this.repository.find({
      where: { item: { id: itemId } },
      relations: RELATIONS,
    });
  }

  /**
   * Get itemCategory list that matches the parents of `itemId` or `null`, if not found.
   * @param item The item used to retrieve its item categories
   */
  async getForItemOrParent(item: Item): Promise<ItemCategory[]> {
    super.throwsIfParamIsInvalid('itemPath', item?.path);

    return await this.repository
      .createQueryBuilder('ic')
      .innerJoinAndSelect('ic.category', 'category', 'ic.item_path @> :itemPath', {
        itemPath: item.path,
      })
      .getMany();
  }

  /**
   * Get itemCategory for a given member.
   * @param memberId the id of the member.
   * @returns an array of the item categories.
   */
  async getForMemberExport(memberId: string): Promise<ItemCategory[]> {
    super.throwsIfParamIsInvalid('memberId', memberId);

    return await this.repository.find({
      select: schemaToSelectMapper(itemCategorySchema),
      where: { creator: { id: memberId } },
      relations: RELATIONS,
    });
  }

  async addOne({ itemPath, categoryId }: CreateItemCategoryBody) {
    try {
      return await super.insert({ item: { path: itemPath }, category: { id: categoryId } });
    } catch (e) {
      if (e instanceof InsertionException) {
        throw new DuplicateItemCategoryError({ itemPath, categoryId });
      }
      throw e;
    }
  }
}
