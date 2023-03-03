import { AppDataSource } from '../../../../../plugins/datasource';
import {
  ItemValidation,
  ItemValidationProcess,
  ItemValidationStatus,
} from '../entities/ItemValidation';

export const ItemValidationRepository = AppDataSource.getRepository(ItemValidation).extend({
  async get(id: string): Promise<ItemValidation> {
    return this.findOneBy({ id });
  },

  async getForGroup(groupId: string): Promise<ItemValidation[]> {
    return this.findBy({ group: { id: groupId } });
  },

  /**
   * Create an entry for the validation attempt in item-validation
   * @param {string} itemId id of the item being validated
   */
  async post(
    itemId: string,
    itemValidationGroupId: string,
    process: ItemValidationProcess,
    status = ItemValidationStatus.Pending,
  ): Promise<ItemValidation> {
    const entry = this.create({ itemId, itemValidationGroupId, process, status });
    await this.insert(entry);
    return entry;
  },

  async patch(
    itemValidationId: string,
    args: { result: string; status: ItemValidationStatus },
  ): Promise<ItemValidation> {
    await this.update(itemValidationId, args);
    // TODO: optimize
    return this.get(itemValidationId);
  },
});
