import { EntityManager } from 'typeorm';

import { TagCategory, UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { isDuplicateEntryError } from '../../../../utils/typeormError';
import { Tag } from '../../../tag/Tag.entity';
import { TagCount } from '../../../tag/schemas';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag.entity';
import { TAG_COUNT_MAX_RESULTS } from './constants';
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

  async getCountBy({
    search,
    category,
  }: {
    search: string;
    category?: TagCategory;
  }): Promise<TagCount[]> {
    if (!search) {
      throw new IllegalArgumentException(`search is invalid: "${search}"`);
    }

    const q = this.repository
      .createQueryBuilder('itemTag')
      .select(['t.name AS name', 't.category AS category', 'count(t.id)::integer as count'])
      .innerJoinAndSelect('tag', 't', 't.id = itemTag.tag_id AND t.name ILIKE :search', {
        search: `%${search}%`,
      });

    if (category) {
      q.where('category = :category', { category });
    }

    const result = await q
      .groupBy('t.id')
      .orderBy('count', 'DESC')
      .limit(TAG_COUNT_MAX_RESULTS)
      .getRawMany<TagCount>();

    return result;
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

  async delete(itemId: Item['id'], tagId: Tag['id']): Promise<void> {
    if (!itemId || !tagId) {
      throw new IllegalArgumentException(`Given 'itemId' or 'tagId' is undefined!`);
    }
    await this.repository.delete({ itemId, tagId });
  }
}
