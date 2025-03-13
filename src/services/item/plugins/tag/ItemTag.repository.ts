import { getTableColumns } from 'drizzle-orm';
import { and, asc, desc, eq, ilike } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { itemTags, tags } from '../../../../drizzle/schema';
import { Item, TagRaw } from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { TagCategoryOptions, TagCount } from '../../../tag/schemas';
import { TAG_COUNT_MAX_RESULTS } from './constants';
import { ItemTagAlreadyExists } from './errors';

@singleton()
export class ItemTagRepository {
  async getByItemId(db: DBConnection, itemId: UUID): Promise<TagRaw[]> {
    if (!itemId) {
      throw new IllegalArgumentException(`The given 'itemId' is undefined!`);
    }

    const result = await db
      .select(
        // only take the tags columns
        getTableColumns(tags),
      )
      .from(tags)
      .leftJoin(itemTags, eq(tags.id, itemTags.tagId))
      .where(eq(itemTags.itemId, itemId))
      .orderBy(asc(tags.category), asc(tags.name));

    return result;
  }

  async getCountBy(
    db: DBConnection,
    {
      search,
      category,
    }: {
      search: string;
      category: TagCategoryOptions;
    },
  ): Promise<TagCount[]> {
    if (!search) {
      throw new IllegalArgumentException(`search is invalid: "${search}"`);
    }
    const selectCols = {
      id: tags.id,
      name: tags.name,
      category: tags.category,
      count: db.$count(itemTags, eq(itemTags.tagId, tags.id)),
    };
    const res = await db
      .select(selectCols)
      .from(tags)
      .where(and(ilike(tags.name, `%${search}%`), eq(tags.category, category)))
      .orderBy(desc(selectCols.count))
      .limit(TAG_COUNT_MAX_RESULTS);

    // const q = this.repository
    //   .createQueryBuilder('itemTag')
    //   .select([
    //     't.id AS id',
    //     't.name AS name',
    //     't.category AS category',
    //     'count(t.id)::integer as count',
    //   ])
    //   .innerJoinAndSelect('tag', 't', 't.id = itemTag.tag_id AND t.name ILIKE :search', {
    //     search: `%${search}%`,
    //   });

    // if (category) {
    //   q.where('category = :category', { category });
    // }

    // const result = await q
    //   .groupBy('t.id')
    //   .orderBy('count', 'DESC')
    //   .limit(TAG_COUNT_MAX_RESULTS)
    //   .getRawMany<TagCount>();

    return res;
  }

  async create(db: DBConnection, itemId: UUID, tagId: TagRaw['id']): Promise<void> {
    try {
      await db.insert(itemTags).values({ itemId, tagId });
    } catch (e) {
      throw new ItemTagAlreadyExists({ itemId, tagId });
    }
  }

  async delete(db: DBConnection, itemId: Item['id'], tagId: TagRaw['id']): Promise<void> {
    if (!itemId || !tagId) {
      throw new IllegalArgumentException(`Given 'itemId' or 'tagId' is undefined!`);
    }
    // remove association between item and tag in tag association table
    await db.delete(itemTags).where(and(eq(itemTags.tagId, tagId), eq(itemTags.itemId, itemId)));
  }
}
