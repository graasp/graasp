import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../../../repositories/AbstractRepository';
import { ItemValidationGroup } from '../entities/ItemValidationGroup';
import { ItemValidationGroupNotFound } from '../errors';

export class ItemValidationGroupRepository extends AbstractRepository<ItemValidationGroup> {
  constructor(manager?: EntityManager) {
    super(ItemValidationGroup, manager);
  }

  /**
   * Get item validation groups of given iVId
   * @param {string} iVId id of the item being checked
   */
  async get(id: string): Promise<ItemValidationGroup> {
    const ivg = await this.repository.findOne({
      where: { id },
      relations: { item: true, itemValidations: true },
    });

    if (!ivg) {
      throw new ItemValidationGroupNotFound(id);
    }

    return ivg;
  }

  /**
   * Get last item validation group for given item id
   * @param {string} itemId id of the item being checked
   */
  async getLastForItem(itemId: string): Promise<ItemValidationGroup | null> {
    if (!itemId) {
      throw new ItemValidationGroupNotFound(itemId);
    }
    // return this.createQueryBuilder('iVG')
    // .leftJoinAndSelect('iVG.item', 'item')
    // .leftJoinAndSelect('iVG.itemValidations', 'itemValidation')
    // .where('item.id = :itemId', {itemId})
    // .orderBy('iVG.createdAt', 'DESC')
    // .getOne();
    const result = await this.repository.findOne({
      where: { item: { id: itemId } },
      order: { createdAt: 'desc' },
      relations: ['item', 'itemValidations', 'itemValidations.item'],
    });
    return result;
  }

  /**
   * Create an entry for the automatic validation process in item-validation-group
   * @param {string} itemId id of the item being validated
   */
  async post(itemId: string): Promise<ItemValidationGroup> {
    const created = await this.repository.insert({ item: { id: itemId } });
    return this.get(created.identifiers[0].id);
  }
}
