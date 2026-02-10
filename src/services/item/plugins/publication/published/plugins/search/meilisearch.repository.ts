import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { type IndexItem, ItemVisibilityType } from '@graasp/sdk';

import { DBConnection } from '../../../../../../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../../../../../../drizzle/operations';
import {
  accountsTable,
  itemLikesTable,
  itemTagsTable,
  itemVisibilitiesTable,
  items,
  publishedItemsTable,
  tagsTable,
} from '../../../../../../../drizzle/schema';
import { TagCategory } from '../../../../../../tag/tag.schemas';
import type { ItemRaw } from '../../../../../item';
import { stripHtml } from '../../../validation/utils';

@singleton()
export class MeilisearchRepository {
  constructor() {}

  public async getIndexedTree(db: DBConnection, itemPath: ItemRaw['path']): Promise<IndexItem[]> {
    // Define CTE "tree" with descendants and self of given item that are not hidden
    const tree = db.$with('tree').as(
      db
        .select({
          id: items.id,
          name: items.name,
          description: items.description,
          creatorId: items.creatorId,
          path: items.path,
          type: items.type,
          lang: items.lang,
          createdAt: items.createdAt,
          updatedAt: items.updatedAt,
          extra: items.extra,
        })
        .from(items)
        .leftJoin(
          itemVisibilitiesTable,
          and(
            isAncestorOrSelf(itemVisibilitiesTable.itemPath, items.path),
            eq(itemVisibilitiesTable.type, ItemVisibilityType.Hidden),
          ),
        )
        .where(and(isDescendantOrSelf(items.path, itemPath), isNull(itemVisibilitiesTable.id))),
    );

    // Define "tags" CTE with filtered aggregation for each tag category
    const tagsCte = db.$with('tags').as(
      db
        .select({
          itemId: itemTagsTable.itemId,
          discipline: sql<
            string[]
          >`array_agg(${tagsTable.name}) filter (where ${tagsTable.category}=${TagCategory.Discipline})`.as(
            'discipline',
          ),
          level: sql<
            string[]
          >`array_agg(${tagsTable.name}) filter (where ${tagsTable.category}=${TagCategory.Level})`.as(
            'level',
          ),
          resourceType: sql<
            string[]
          >`array_agg(${tagsTable.name}) filter (where ${tagsTable.category}=${TagCategory.ResourceType})`.as(
            'resourceType',
          ),
        })
        .from(tagsTable)
        .leftJoin(itemTagsTable, eq(tagsTable.id, itemTagsTable.tagId))
        .innerJoin(tree, eq(tree.id, itemTagsTable.itemId))
        .groupBy(itemTagsTable.itemId),
    );

    // Define "likes" CTE counting likes per item
    const likesCte = db.$with('likes').as(
      db
        .select({
          itemId: itemLikesTable.itemId,
          count: count(itemLikesTable.itemId).as('count'),
        })
        .from(itemLikesTable)
        .innerJoin(tree, eq(tree.id, itemLikesTable.itemId))
        .groupBy(itemLikesTable.itemId),
    );

    // Build main query referencing the CTEs and joins
    const result = await db
      .with(tree, tagsCte, likesCte)
      .select({
        // item properties
        id: tree.id,
        name: tree.name,
        description: tree.description,
        path: tree.path,
        type: tree.type,
        // get content for documents and files
        content: sql<string>`COALESCE(${tree.extra}->'document'->>'content', ${tree.extra}->'file'->>'content','')`,
        lang: tree.lang,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
        // publication
        publishedRootPath: publishedItemsTable.itemPath,
        publicationUpdatedAt: publishedItemsTable.updatedAt,
        // tags
        // use coalesce to return an empty array if the item does not have tags
        discipline: sql<string[]>`COALESCE(${tagsCte.discipline},'{}')`,
        level: sql<string[]>`COALESCE(${tagsCte.level},'{}')`,
        resourceType: sql<string[]>`COALESCE(${tagsCte.resourceType},'{}')`,
        // creator
        creatorId: accountsTable.id,
        creatorName: accountsTable.name,
        // likes
        // coalesce in case item does not have any like
        likes: sql<number>`COALESCE(${likesCte.count},0)::int`,
      })
      .from(tree)
      .innerJoin(publishedItemsTable, isAncestorOrSelf(publishedItemsTable.itemPath, tree.path))
      .leftJoin(accountsTable, eq(accountsTable.id, tree.creatorId))
      .leftJoin(tagsCte, eq(tagsCte.itemId, tree.id))
      .leftJoin(likesCte, eq(likesCte.itemId, tree.id));

    return result.map((doc) => ({
      id: doc.id,
      name: doc.name,
      creator: {
        id: doc.creatorId ?? '',
        name: doc.creatorName ?? '',
      },
      description: doc.description ? stripHtml(doc.description) : '',
      type: doc.type,
      content: doc.content ? stripHtml(doc.content) : '',
      isPublishedRoot: doc.path === doc.publishedRootPath,
      publicationUpdatedAt: doc.publicationUpdatedAt,
      // to be removed
      isHidden: false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lang: doc.lang,
      likes: doc.likes,
      discipline: doc.discipline,
      level: doc.level,
      'resource-type': doc.resourceType,
    }));
  }
}
