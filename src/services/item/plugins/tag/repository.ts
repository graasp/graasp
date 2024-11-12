import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { ItemTag } from './ItemTag.entity';
import { Tag } from './Tag.entity';

export class ItemTagRepository extends AbstractRepository<ItemTag> {
  constructor(manager?: EntityManager) {
    super(ItemTag, manager);
  }

  async getForItem(itemId: UUID): Promise<Tag[]> {
    if (!itemId) {
      throw new IllegalArgumentException(`The given 'itemId' is undefined!`);
    }

    const itemTags = await this.repository.find({ where: { itemId }, relations: { tag: true } });
    return itemTags.map(({ tag }) => tag);
  }
}
