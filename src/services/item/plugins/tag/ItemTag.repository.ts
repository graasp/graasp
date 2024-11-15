import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { isDuplicateEntryError } from '../../../../utils/typeormError';
import { ItemTag } from './ItemTag.entity';
import { Tag } from './Tag.entity';
import { ItemTagAlreadyExists } from './errors';

export class ItemTagRepository extends AbstractRepository<ItemTag> {
  constructor(manager?: EntityManager) {
    super(ItemTag, manager);
  }

  async getByItemId(itemId: UUID): Promise<Tag[]> {
    if (!itemId) {
      throw new IllegalArgumentException(`The given 'itemId' is undefined!`);
    }

    const itemTags = await this.repository.find({ where: { itemId }, relations: { tag: true } });
    return itemTags.map(({ tag }) => tag);
  }

  async create(itemId: UUID, tagId: Tag['id']): Promise<void> {
    try {
      await this.repository.insert({ itemId, tagId });
    } catch (e) {
      if (isDuplicateEntryError(e)) {
        throw new ItemTagAlreadyExists({ itemId, tagId });
      }
      throw e;
    }
  }
}
