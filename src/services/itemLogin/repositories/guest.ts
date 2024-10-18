import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

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

  async get(id: UUID) {
    if (!id) {
      return undefined;
    }
    const result = await this.repository.findOneBy({ id });
    if (result === null) {
      return undefined;
    }
    return result;
  }

  async refreshLastAuthenticatedAt(id: UUID, lastAuthenticatedAt: Date) {
    await this.repository.update(id, { lastAuthenticatedAt });

    return this.get(id);
  }
}
