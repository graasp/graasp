import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../repositories/AbstractRepository';
import { AncestorOf } from '../../../utils/typeorm/treeOperators';
import { Item } from '../../item/entities/Item';
import { Guest } from '../entities/guest';

export class GuestRepository extends AbstractRepository<Guest> {
  constructor(manager?: EntityManager) {
    super(Guest, manager);
  }

  async getForItemAndUsername(item: Item, username: string): Promise<Guest | null> {
    return this.repository.findOne({
      where: {
        name: username,
        itemLoginSchema: { item: { path: AncestorOf(item.path) } },
      },
      relations: {
        itemLoginSchema: {
          item: true,
        },
      },
    });
  }

  async addOne(guestData: Partial<Omit<Guest, 'id'>>): Promise<Guest> {
    return await this.repository.save({
      ...guestData,
    });
  }
}
