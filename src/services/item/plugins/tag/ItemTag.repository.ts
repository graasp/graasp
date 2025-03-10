import { and, asc, eq, ilike } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { itemTags, tags } from '../../../../drizzle/schema';
import { Item, TagRaw } from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { assertIsError } from '../../../../utils/assertions';
import { TagCategoryOptions, TagCount } from '../../../tag/schemas';
import { TAG_COUNT_MAX_RESULTS } from './constants';

@singleton()
export class ItemTagRepository {
  async getByItemId(db: DBConnection, itemId: UUID): Promise<TagRaw[]> {
    if (!itemId) {
      throw new IllegalArgumentException(`The given 'itemId' is undefined!`);
    }

    const result = await db.query.itemTags.findMany({
      where: eq(itemTags.itemId, itemId),
      with: { tag: true },
      orderBy: [asc(tags.category), asc(tags.name)],
    });
    return result.map(({ tag }) => tag);
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
    const res = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
        count: db.$count(itemTags, eq(itemTags.tagId, tags.id)),
      })
      .from(tags)
      .where(and(ilike(tags.name, `%${search}%`), eq(tags.category, category)))
      // TODO: add the orderBy count desc
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
      await db.insert(itemTags).values({ itemId, tagId }).onConflictDoNothing();
    } catch (e) {
      assertIsError(e);
      throw e;
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
