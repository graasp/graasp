import { AppDataSource } from '../../../../../plugins/datasource';
import { ItemValidation, ItemValidationStatus } from '../entities/ItemValidation';
import { ItemValidationGroup } from '../entities/ItemValidationGroup';

export const ItemValidationGroupRepository = AppDataSource.getRepository(ItemValidation).extend({
  /**
   * Get item validation groups of given iVId
   * @param {string} iVId id of the item being checked
   */
  async get(id: string): Promise<ItemValidationGroup> {
    return this.findOne({ where: { id }, relations: { item: true, itemValidations: true } });
  },

  /**
   * Get last item validation group for given item id
   * @param {string} itemId id of the item being checked
   */
  async getLastForItem(itemId: string): Promise<ItemValidationGroup> {
    return this.findOne({
      where: { item: { id: itemId } },
      order: { createdAt: 'desc' },
      relations: { item: true, itemValidations: true },
    });
  },

  /**
   * Create an entry for the automatic validation process in item-validation-group
   * @param {string} itemId id of the item being validated
   */
  async post(itemId: string): Promise<ItemValidationGroup> {
    const entry = this.create({ item: { id: itemId } });
    await this.insert(entry);
    return entry;
  },

  /**
   * Update an entry for the automatic validation process in DB
   * @param {string} id id of the validation group
   * @param {string} status new status of process, failure or success
   */
  async patch(id: string, status: ItemValidationStatus): Promise<ItemValidationGroup> {
    return this.update(id, { status });
  },
});
