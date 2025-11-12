import { getTableColumns } from 'drizzle-orm';
import { and, asc, desc, eq, ilike } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import type { UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { itemTagsTable, tagsTable } from '../../../../drizzle/schema';
import { type ItemRaw, type TagRaw } from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import type { TagCategoryOptions, TagCount } from '../../../tag/tag.schemas';
import { TAG_COUNT_MAX_RESULTS } from './constants';
import { ItemTagAlreadyExists } from './errors';

@singleton()
export class ItemTagRepository {
  async getByItemId(dbConnection: DBConnection, itemId: UUID): Promise<TagRaw[]> {
    if (!itemId) {
      throw new IllegalArgumentException(`The given 'itemId' is undefined!`);
    }

    const result = await dbConnection
      .select(
        // only take the tags columns
        getTableColumns(tagsTable),
      )
      .from(tagsTable)
      .leftJoin(itemTagsTable, eq(tagsTable.id, itemTagsTable.tagId))
      .where(eq(itemTagsTable.itemId, itemId))
      .orderBy(asc(tagsTable.category), asc(tagsTable.name));

    return result;
  }

  async getCountBy(
    dbConnection: DBConnection,
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
      id: tagsTable.id,
      name: tagsTable.name,
      category: tagsTable.category,
      count: dbConnection.$count(itemTagsTable, eq(itemTagsTable.tagId, tagsTable.id)),
    };
    const res = await dbConnection
      .select(selectCols)
      .from(tagsTable)
      .where(and(ilike(tagsTable.name, `%${search}%`), eq(tagsTable.category, category)))
      .orderBy(desc(selectCols.count))
      .limit(TAG_COUNT_MAX_RESULTS);

    return res;
  }

  async create(dbConnection: DBConnection, itemId: UUID, tagId: TagRaw['id']): Promise<void> {
    try {
      await dbConnection.insert(itemTagsTable).values({ itemId, tagId });
    } catch (_e) {
      throw new ItemTagAlreadyExists({ itemId, tagId });
    }
  }

  async delete(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    tagId: TagRaw['id'],
  ): Promise<void> {
    if (!itemId || !tagId) {
      throw new IllegalArgumentException(`Given 'itemId' or 'tagId' is undefined!`);
    }
    // remove association between item and tag in tag association table
    await dbConnection
      .delete(itemTagsTable)
      .where(and(eq(itemTagsTable.tagId, tagId), eq(itemTagsTable.itemId, itemId)));
  }
}
