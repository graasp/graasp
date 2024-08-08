import { EntityManager } from 'typeorm';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { AbstractRepository } from '../../../../../../repository';
import { ItemValidation } from '../entities/ItemValidation';
import { ItemValidationGroupNotFound, ItemValidationNotFound } from '../errors';

export class ItemValidationRepository extends AbstractRepository<ItemValidation> {
  constructor(manager?: EntityManager) {
    super(ItemValidation, manager);
  }

  async get(id: string): Promise<ItemValidation> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new ItemValidationNotFound(id);
    }
    const result = await this.repository.findOneBy({ id });
    if (!result) {
      throw new ItemValidationNotFound(id);
    }
    return result;
  }

  async getForGroup(groupId: string): Promise<ItemValidation[]> {
    if (!groupId) {
      throw new ItemValidationGroupNotFound(groupId);
    }
    return this.repository.findBy({ itemValidationGroup: { id: groupId } });
  }

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
    const created = await this.repository.insert({
      item: { id: itemId },
      itemValidationGroup: { id: itemValidationGroupId },
      process,
      status,
    });
    return this.get(created.identifiers[0].id);
  }

  async patch(
    itemValidationId: string,
    args: { result?: string; status: ItemValidationStatus },
  ): Promise<ItemValidation> {
    await this.repository.update(itemValidationId, args);
    // TODO: optimize
    return this.get(itemValidationId);
  }
}
