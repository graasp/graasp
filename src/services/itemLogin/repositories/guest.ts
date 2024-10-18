import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { ImmutableRepository } from '../../../repositories/ImmutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../repositories/const';
import { AncestorOf } from '../../../utils/typeorm/treeOperators';
import { Item } from '../../item/entities/Item';
import { Guest } from '../entities/guest';
import { GuestNotFound } from '../errors';

export class GuestRepository extends ImmutableRepository<Guest> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, Guest, manager);
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

  async refreshLastAuthenticatedAt(id: UUID) {
    await this.repository.update(id, { lastAuthenticatedAt: new Date() });

    return await super.getOneOrThrow(id, {}, new GuestNotFound(id));
  }
}
