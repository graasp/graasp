import { EntityManager } from 'typeorm';

import { TagCategory, UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { isDuplicateEntryError } from '../../../../utils/typeormError';
import { Tag } from '../../../tag/Tag.entity';
import { TagCount } from '../../../tag/schemas';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag.entity';
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
      .select(['t.name AS name', 't.category AS category', 'count(t.id) as count'])
      .leftJoinAndSelect('tag', 't', 't.id = itemTag.tag_id AND t.name ILIKE :search', {
        search: `%${search}%`,
      });

    if (category) {
      q.where('category = :category', { category });
    }

    const res = await q.groupBy('t.id').orderBy('count', 'DESC').getRawMany<{
      name: Tag['name'];
      category: Tag['category'];
      count: string; // sql returns string by default
    }>();

    // transform into integer
    return res.map((value) => ({ ...value, count: parseInt(value.count) }));
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
